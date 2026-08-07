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
    },
  },
  assignedStaff: { select: { id: true, displayName: true } },
  items: { orderBy: { id: "asc" as const } },
} satisfies Prisma.OrderInclude;

export type PostgresOrderRecord = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

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

function orderIdentity(order: PostgresOrderRecord) {
  return order.legacyPhpId || order.id.toString();
}

export function postgresOrderDedupeIds(order: PostgresOrderRecord) {
  return [order.id.toString(), order.orderNumber, order.legacyPhpId].map(text).filter(Boolean);
}

export function mapPostgresOrderItemToLegacy(item: PostgresOrderRecord["items"][number], order: PostgresOrderRecord) {
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

export function mapPostgresOrderToLegacy(order: PostgresOrderRecord) {
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
  };
  return row;
}

function actorWhere(actor: OrdersActor): Prisma.OrderWhereInput {
  if (actor.role === "dealer") return { dealerId: BigInt(actor.actorId) };
  if (actor.role === "staff") return { assignedStaffId: BigInt(actor.actorId) };
  return {};
}

export async function listPostgresOrderHeaders(actor: OrdersActor) {
  const orders = await prisma.order.findMany({
    where: actorWhere(actor),
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
    include: orderInclude,
  });
}
