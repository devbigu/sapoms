import { AdminRouteError } from "@/server/admin/admin-errors";
import { adminProductRepository } from "./products.repository";
import { mapAdminProduct } from "./products.mapper";
import type { AdminProductListInput } from "./products.types";

export async function listAdminProducts(input: AdminProductListInput) {
  const result = await adminProductRepository.list(input);
  return { items: result.items.map(mapAdminProduct), total: result.total };
}

export async function getAdminProduct(productId: bigint) {
  const record = await adminProductRepository.findById(productId);
  if (!record) throw new AdminRouteError("NOT_FOUND", "Product not found");
  return mapAdminProduct(record);
}