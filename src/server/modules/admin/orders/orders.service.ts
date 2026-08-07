import { AdminRouteError } from "@/server/admin/admin-errors";
import { adminOrderRepository } from "./orders.repository";
import { mapAdminOrderDetail, mapAdminOrderListItem } from "./orders.mapper";
import type { AdminOrderListInput } from "./orders.types";

export async function listAdminOrders(input: AdminOrderListInput) {
  const result = await adminOrderRepository.list(input);
  return { items: result.items.map(mapAdminOrderListItem), total: result.total };
}

export async function getAdminOrder(orderId: bigint) {
  const record = await adminOrderRepository.findById(orderId);
  if (!record) throw new AdminRouteError("NOT_FOUND", "Order not found");
  return mapAdminOrderDetail(record);
}