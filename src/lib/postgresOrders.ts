import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import type { OrdersActor } from "@/lib/orderPagination";

const orderInclude = {
  dealer: {
    select: {
      id: true,
      businessName: true,
      dealerCode: true,
      phone: true,
      city: true,
      address: true,
      pincode: true,
      gstin: true,
      discountPercent: true,
      creditDays: true,
    },
  },
  assignedStaff: { select: { id: true, displayName: true } },
  items: { orderBy: { id: "asc" as const } },
} satisfies Prisma.OrderInclude;

const orderDetailInclude = {
  ...orderInclude,
  items: { orderBy: { id: "asc" as const }, include: { dispatches: { orderBy: { createdAt: "asc" as const } }, productNotes: { orderBy: { updatedAt: "desc" as const } } } },
  notes: { orderBy: { updatedAt: "desc" as const } },
  productNotes: { orderBy: { updatedAt: "desc" as const } },
  summaryOverrides: { orderBy: { createdAt: "desc" as const } },
  overlays: { orderBy: { updatedAt: "desc" as const } },
  dispatches: { orderBy: { createdAt: "asc" as const } },
  walletTransactions: { orderBy: { createdAt: "desc" as const } },
} satisfies Prisma.OrderInclude;

export type PostgresOrderRecord = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;
type PostgresOrderDetailRecord = Prisma.OrderGetPayload<{ include: typeof orderDetailInclude }>;
type PostgresOrderLike = PostgresOrderRecord | PostgresOrderDetailRecord;

function text(value: unknown) {
  return String(value ?? "").trim();
}

function rupees(value: bigint) {
  return Number(value) / 100;
}

function percent(value: unknown) {
  return Number(value ?? 0);
}

function legacyAcceptance(status: string) {
  if (status === "ACCEPTED") return "1";
  if (status === "DECLINED") return "2";
  return "0";
}

function legacyDeletion(status: string) {
  return status === "CANCELLED" ? "1" : "0";
}

function legacyOrderStatus(status: string) {
  if (status === "CANCELLED") return "cancelled";
  if (status === "COMPLETED") return "approved";
  if (status === "ACCEPTED" || status === "PROCESSING" || status === "READY" || status === "DISPATCHED") return "approved";
  return "pending";
}

function legacyFulfilment(status: string) {
  if (status === "IN_PROCESS") return "InProcess";
  if (status === "COMPLETED" || status === "DISPATCHED") return "Completed";
  return "Pending";
}

function legacyDispatchStatus(status: string) {
  if (status === "DISPATCHED" || status === "COMPLETED") return "dispatched";
  if (status === "READY" || status === "PARTIALLY_READY" || status === "IN_PROCESS") return "packing";
  return "pending";
}

function orderIdentity(order: PostgresOrderRecord) {
  return order.legacyPhpId || order.id.toString();
}

export function postgresOrderDedupeIds(order: PostgresOrderRecord) {
  return [order.id.toString(), order.orderNumber, order.legacyPhpId].map(text).filter(Boolean);
}

export function mapPostgresOrderItemToLegacy(item: PostgresOrderLike["items"][number], order: PostgresOrderLike) {
  const orderId = orderIdentity(order);
  const itemId = item.legacyPhpOrderItemId || item.id.toString();
  return {
    __source: "postgres",
    id: itemId,
    orderdata_id: itemId,
    orderdata_orderid: orderId,
    order_id: orderId,
    order_number: order.orderNumber,
    orderdata_dealerid: order.dealerId.toString(),
    order_dealer: order.dealerId.toString(),
    Dealer_Id: order.dealerId.toString(),
    Dealer_Name: order.dealer.businessName,
    productname: item.productNameSnapshot,
    productName: item.productNameSnapshot,
    catNo: item.catalogueNumberSnapshot,
    catalogueNumber: item.catalogueNumberSnapshot,
    category: item.categorySnapshot || "",
    producQuanity: item.totalPieces,
    orderdata_item_quantity: String(item.quantityPacks),
    quantityPacks: item.quantityPacks,
    packs: item.quantityPacks,
    packSize: item.packSize,
    pack_size: item.packSize,
    pieces: item.totalPieces,
    totalPieces: item.totalPieces,
    unitPrice: rupees(item.unitPricePaise),
    packPrice: rupees(item.packPricePaise),
    order_amount: rupees(item.listPriceTotalPaise),
    grossAmount: rupees(item.listPriceTotalPaise),
    discountPercent: percent(item.discountPercent),
    discountAmount: rupees(item.discountAmountPaise),
    discountAmountPaise: item.discountAmountPaise.toString(),
    finalAmount: rupees(item.finalAmountPaise),
    finalPayableAmount: rupees(item.finalAmountPaise),
    finalAmountPaise: item.finalAmountPaise.toString(),
    remarks: item.remarks || "",
    productNote: item.productNote || "",
    product_note: item.productNote || "",
    priority: item.isPriority ? "1" : "0",
    isPriority: item.isPriority,
    status: order.status,
    order_status: legacyOrderStatus(order.status),
    accept_order: legacyAcceptance(order.acceptanceStatus),
    acceptanceStatus: order.acceptanceStatus,
    acceptance_status: order.acceptanceStatus,
    fulfilmentStatus: order.fulfilmentStatus,
    fulfilment_status: order.fulfilmentStatus,
    mtstatus: legacyFulfilment(order.fulfilmentStatus),
    del_status: legacyDeletion(order.status),
    orderdata_datetime: order.orderDate.toISOString(),
  };
}

export function mapPostgresOrderToLegacy(order: PostgresOrderLike) {
  const orderId = orderIdentity(order);
  const discountAmount = rupees(order.totalDiscountAmountPaise);
  const finalPayableAmount = rupees(order.finalPayableAmountPaise);
  const row = {
    __source: "postgres",
    id: orderId,
    orderId,
    order_id: orderId,
    order_number: order.orderNumber,
    order_dealer: order.dealerId.toString(),
    orderdata_dealerid: order.dealerId.toString(),
    Dealer_Id: order.dealerId.toString(),
    Dealer_Name: order.dealer.businessName,
    Dealer_Dealercode: order.dealer.dealerCode || "",
    Dealer_Number: order.dealer.phone || "",
    Dealer_City: order.dealer.city || "",
    Dealer_Address: order.dealer.address || "",
    Dealer_Pincode: order.dealer.pincode || "",
    gst: order.dealer.gstin || "",
    creditdays: order.dealer.creditDays?.toString() || "",
    assignedstaff: order.assignedStaffId?.toString() || "",
    staffid: order.assignedStaffId?.toString() || "",
    staffname: order.assignedStaff?.displayName || "",
    order_date: order.orderDate.toISOString(),
    orderdata_datetime: order.orderDate.toISOString(),
    order_amount: rupees(order.grossAmountPaise),
    grossAmount: rupees(order.grossAmountPaise),
    grossAmountPaise: order.grossAmountPaise.toString(),
    order_discount: discountAmount,
    discountAmount,
    discountAmountPaise: order.totalDiscountAmountPaise.toString(),
    finalPayableAmount,
    finalPayableAmountPaise: order.finalPayableAmountPaise.toString(),
    baseDiscountPercent: percent(order.baseDiscountPercent),
    baseDiscountAmount: rupees(order.baseDiscountAmountPaise),
    additionalDiscountType: order.additionalDiscountType,
    additionalDiscountAmount: rupees(order.additionalDiscountAmountPaise),
    slabDiscountPercent: percent(order.slabDiscountPercent),
    slabDiscountAmount: rupees(order.slabDiscountAmountPaise),
    customDiscountAmount: rupees(order.customDiscountAmountPaise),
    totalDiscountPercent: percent(order.totalDiscountPercent),
    note: order.note || "",
    order_note: order.note || "",
    shipTo: order.shipTo || "",
    Dealer_shipto: order.shipTo || "",
    refNo: order.refNo || "",
    ref_no: order.refNo || "",
    priority: (order.items ?? []).some((item) => item.isPriority) ? "1" : "0",
    status: order.status,
    order_status: legacyOrderStatus(order.status),
    accept_order: legacyAcceptance(order.acceptanceStatus),
    acceptanceStatus: order.acceptanceStatus,
    acceptance_status: order.acceptanceStatus,
    fulfilmentStatus: order.fulfilmentStatus,
    fulfilment_status: order.fulfilmentStatus,
    mtstatus: legacyFulfilment(order.fulfilmentStatus),
    del_status: legacyDeletion(order.status),
    productorder: (order.items ?? []).map((item) => mapPostgresOrderItemToLegacy(item, order)),
    items: (order.items ?? []).map((item) => mapPostgresOrderItemToLegacy(item, order)),
    dealer: order.dealer,
    assignedStaff: order.assignedStaff,
    orderNotes: "notes" in order ? order.notes : [],
    orderProductNotes: ("productNotes" in order ? order.productNotes : []).map((note) => ({
      ...note,
      id: note.id.toString(),
      orderId: note.orderId.toString(),
      orderItemId: note.orderItemId.toString(),
    })),
    summaryOverrides: ("summaryOverrides" in order ? order.summaryOverrides : []).map((override) => ({
      ...override,
      id: override.id.toString(),
      orderId: override.orderId.toString(),
      grossAmount: rupees(override.grossAmountPaise),
      discountAmount: rupees(override.discountAmountPaise),
      netPayableAmount: rupees(override.finalPayableAmountPaise),
    })),
    overlays: ("overlays" in order ? order.overlays : []).map((overlay) => ({ ...overlay, id: overlay.id.toString(), orderId: overlay.orderId.toString() })),
    dispatchRecords: ("dispatches" in order ? order.dispatches : []).map((dispatch) => ({
      id: dispatch.id.toString(),
      orderId: dispatch.orderId.toString(),
      orderItemId: dispatch.orderItemId.toString(),
      quantity: dispatch.quantity,
      status: legacyDispatchStatus(dispatch.status),
      remark: dispatch.remark || "",
      actorId: dispatch.actorUserId?.toString() || "",
      actorRole: (dispatch.actorRole || "").toString().toLowerCase(),
      createdAt: dispatch.createdAt.toISOString(),
    })),
    walletTransactions: ("walletTransactions" in order ? order.walletTransactions : []).map((transaction) => ({
      ...transaction,
      id: transaction.id.toString(),
      dealerId: transaction.dealerId.toString(),
      walletId: transaction.walletId.toString(),
      orderId: transaction.orderId?.toString() || null,
      amount: rupees(transaction.amountPaise),
      balanceBefore: rupees(transaction.balanceBeforePaise),
      balanceAfter: rupees(transaction.balanceAfterPaise),
    })),
  };
  return row;
}

function actorWhere(actor: OrdersActor, assignedDealerIds: Array<string | number> = []): Prisma.OrderWhereInput {
  if (actor.role === "dealer") return { dealerId: BigInt(actor.actorId) };
  if (actor.role === "staff") {
    const assignedDealerBigInts = assignedDealerIds
      .map((id) => String(id ?? "").trim())
      .filter((id) => /^\d+$/.test(id))
      .map((id) => BigInt(id));
    return {
      OR: [
        { assignedStaffId: BigInt(actor.actorId) },
        ...(assignedDealerBigInts.length > 0 ? [{ dealerId: { in: assignedDealerBigInts } }] : []),
      ],
    };
  }
  return {};
}

export async function listPostgresOrderHeaders(actor: OrdersActor, assignedDealerIds: Array<string | number> = []) {
  const orders = await prisma.order.findMany({
    where: actorWhere(actor, assignedDealerIds),
    include: orderInclude,
    orderBy: { orderDate: "desc" },
  });
  return orders.map(mapPostgresOrderToLegacy);
}

export async function findPostgresOrderByLookupId(orderId: unknown) {
  const id = text(orderId);
  if (!id) return null;
  const numericId = /^\d+$/.test(id) ? BigInt(id) : null;
  return prisma.order.findFirst({
    where: {
      OR: [
        ...(numericId ? [{ id: numericId }] : []),
        { orderNumber: id },
        { legacyPhpId: id },
      ],
    },
    include: orderDetailInclude,
  });
}
