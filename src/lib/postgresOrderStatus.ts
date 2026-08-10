import type { OrderAcceptanceStatus, OrderFulfilmentStatus, OrderStatus } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import type { AuthActor } from "@/server/auth/session";

export class PostgresOrderStatusError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "PostgresOrderStatusError";
    this.status = status;
    this.code = code;
  }
}

type StatusOrder = NonNullable<Awaited<ReturnType<typeof findPostgresStatusOrder>>>;

const fulfilmentFlow: OrderFulfilmentStatus[] = [
  "PENDING",
  "IN_PROCESS",
  "PARTIALLY_READY",
  "READY",
  "DISPATCHED",
  "COMPLETED",
];

function normalizeLookup(value: unknown) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/(?:^|\/)(\d+)$/);
  return match?.[1] ?? raw;
}

export function legacyAcceptOrderAlias(status: OrderAcceptanceStatus) {
  if (status === "ACCEPTED") return "1";
  if (status === "DECLINED") return "2";
  return "0";
}

export function legacyDelStatusAlias(status: OrderStatus) {
  return status === "CANCELLED" ? "1" : "0";
}

function orderStatusForFulfilment(status: OrderFulfilmentStatus): OrderStatus {
  if (status === "PENDING") return "ACCEPTED";
  if (status === "IN_PROCESS") return "PROCESSING";
  return status;
}

export function normalizeFulfilmentStatus(value: unknown): OrderFulfilmentStatus | null {
  const normalized = String(value ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (normalized === "INPROCESS") return "IN_PROCESS";
  if (normalized === "PARTIAL" || normalized === "PARTIALLYREADY") return "PARTIALLY_READY";
  if (normalized === "SUCCESSFUL" || normalized === "SUCCESS") return "COMPLETED";
  if (fulfilmentFlow.includes(normalized as OrderFulfilmentStatus)) return normalized as OrderFulfilmentStatus;
  return null;
}

export async function findPostgresStatusOrder(orderId: unknown) {
  const lookup = normalizeLookup(orderId);
  if (!lookup) return null;
  const id = /^\d+$/.test(lookup) ? BigInt(lookup) : null;
  return prisma.order.findFirst({
    where: {
      OR: [
        ...(id ? [{ id }] : []),
        { orderNumber: lookup },
        { legacyPhpId: lookup },
      ],
    },
    include: {
      dealer: true,
      assignedStaff: true,
    },
  });
}

async function assertCanAct(actor: AuthActor, order: StatusOrder, permission: "read" | "acceptance" | "fulfilment" | "cancel") {
  if (actor.role === "ADMIN") return;
  if (actor.role === "DEALER") {
    if (order.dealerId !== actor.dealerId) throw new PostgresOrderStatusError(403, "forbidden", "This order belongs to another Dealer.");
    if (permission !== "read" && permission !== "cancel") {
      throw new PostgresOrderStatusError(403, "forbidden", "Dealers cannot perform staff-only order transitions.");
    }
    return;
  }
  if (actor.role === "STAFF") {
    const assignedDirectly = order.assignedStaffId === actor.staffId;
    const assignedDealer = !!actor.staffId && await prisma.dealerStaffAssignment.findFirst({
      where: { dealerId: order.dealerId, staffId: actor.staffId, active: true },
      select: { id: true },
    });
    if (!assignedDirectly && !assignedDealer) {
      throw new PostgresOrderStatusError(403, "forbidden", "This order is outside your assigned Dealer scope.");
    }
    if (permission === "cancel") {
      throw new PostgresOrderStatusError(403, "forbidden", "Staff cannot cancel Dealer orders.");
    }
    return;
  }
  throw new PostgresOrderStatusError(403, "forbidden", "This role cannot update order status.");
}

export function assertAcceptanceTransition(current: OrderAcceptanceStatus, next: OrderAcceptanceStatus) {
  if (current !== "AWAITING" || (next !== "ACCEPTED" && next !== "DECLINED")) {
    throw new PostgresOrderStatusError(409, "invalid_transition", "Order acceptance can move only from AWAITING to ACCEPTED or DECLINED.");
  }
}

export function assertFulfilmentTransition(current: OrderFulfilmentStatus, next: OrderFulfilmentStatus) {
  const currentIndex = fulfilmentFlow.indexOf(current);
  const nextIndex = fulfilmentFlow.indexOf(next);
  if (currentIndex < 0 || nextIndex !== currentIndex + 1) {
    throw new PostgresOrderStatusError(409, "invalid_transition", "Invalid order fulfilment transition.");
  }
}

export function assertDealerCancellationAllowed(order: Pick<StatusOrder, "status" | "acceptanceStatus" | "fulfilmentStatus">) {
  if (order.status === "CANCELLED") throw new PostgresOrderStatusError(409, "order_already_cancelled", "Order is already cancelled.");
  if (order.status === "COMPLETED" || order.fulfilmentStatus !== "PENDING") {
    throw new PostgresOrderStatusError(409, "dispatch_already_started", "This order can no longer be cancelled.");
  }
  if (order.acceptanceStatus !== "AWAITING") {
    throw new PostgresOrderStatusError(409, "order_already_accepted", "Accepted or declined orders cannot be cancelled by Dealer.");
  }
}

export async function updatePostgresOrderAcceptance(orderId: unknown, actor: AuthActor, next: OrderAcceptanceStatus) {
  const order = await findPostgresStatusOrder(orderId);
  if (!order) return null;
  await assertCanAct(actor, order, "acceptance");
  if (order.status === "CANCELLED") throw new PostgresOrderStatusError(409, "order_already_cancelled", "Cancelled orders cannot be accepted or declined.");
  assertAcceptanceTransition(order.acceptanceStatus, next);
  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.order.update({
      where: { id: order.id },
      data: {
        acceptanceStatus: next,
        status: next === "ACCEPTED" ? "ACCEPTED" : "DECLINED",
        acceptedAt: next === "ACCEPTED" ? now : order.acceptedAt,
      },
    });
    await tx.orderOverlay.create({ data: { orderId: order.id, type: "acceptance", status: next.toLowerCase(), value: next, actorUserId: actor.userId, actorRole: actor.role, metadata: { source: "postgres_status" } } });
    return row;
  });
  return { ...updated, accept_order: legacyAcceptOrderAlias(updated.acceptanceStatus), del_status: legacyDelStatusAlias(updated.status) };
}

export async function updatePostgresOrderFulfilment(orderId: unknown, actor: AuthActor, next: OrderFulfilmentStatus) {
  const order = await findPostgresStatusOrder(orderId);
  if (!order) return null;
  await assertCanAct(actor, order, "fulfilment");
  if (order.acceptanceStatus !== "ACCEPTED") throw new PostgresOrderStatusError(409, "not_accepted", "Order must be accepted before fulfilment can change.");
  if (order.status === "CANCELLED" || order.status === "DECLINED") throw new PostgresOrderStatusError(409, "terminal_order", "Terminal orders cannot change fulfilment.");
  assertFulfilmentTransition(order.fulfilmentStatus, next);
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.order.update({
      where: { id: order.id },
      data: {
        fulfilmentStatus: next,
        status: orderStatusForFulfilment(next),
        dispatchedAt: next === "DISPATCHED" ? new Date() : order.dispatchedAt,
        completedAt: next === "COMPLETED" ? new Date() : order.completedAt,
      },
    });
    await tx.orderOverlay.create({ data: { orderId: order.id, type: "status", status: next.toLowerCase(), value: next, actorUserId: actor.userId, actorRole: actor.role, metadata: { source: "postgres_status" } } });
    return row;
  });
  return { ...updated, accept_order: legacyAcceptOrderAlias(updated.acceptanceStatus), del_status: legacyDelStatusAlias(updated.status) };
}

export async function cancelPostgresOrder(orderId: unknown, actor: AuthActor, reason: unknown) {
  const order = await findPostgresStatusOrder(orderId);
  if (!order) return null;
  await assertCanAct(actor, order, "cancel");
  if (actor.role === "DEALER") assertDealerCancellationAllowed(order);
  if (order.status === "COMPLETED") throw new PostgresOrderStatusError(409, "order_already_completed", "Completed orders cannot be cancelled.");
  const reasonText = String(reason ?? "").trim().slice(0, 1000);
  if (!reasonText) throw new PostgresOrderStatusError(400, "blank_reason", "Cancellation reason is required.");
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.order.update({
      where: { id: order.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancellationReason: reasonText,
      },
    });
    await tx.orderOverlay.create({ data: { orderId: order.id, type: "cancel", status: "cancelled", reason: reasonText, actorUserId: actor.userId, actorRole: actor.role, metadata: { source: "postgres_status" } } });
    return row;
  });
  return { ...updated, accept_order: legacyAcceptOrderAlias(updated.acceptanceStatus), del_status: legacyDelStatusAlias(updated.status) };
}




