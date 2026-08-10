import { AdminRouteError } from "@/server/admin/admin-errors";
import { adminProductRepository } from "./products.repository";
import { mapAdminProduct } from "./products.mapper";
import type { AdminProductListInput, ProductWriteInput } from "./products.types";

export async function listAdminProducts(input: AdminProductListInput) {
  const result = await adminProductRepository.list(input);
  return { items: result.items.map(mapAdminProduct), total: result.total };
}

export async function getAdminProduct(productId: bigint) {
  const record = await adminProductRepository.findById(productId);
  if (!record) throw new AdminRouteError("NOT_FOUND", "Product not found");
  return mapAdminProduct(record);
}

export async function createAdminProduct(input: ProductWriteInput) {
  return mapAdminProduct(await adminProductRepository.create(input));
}

export async function updateAdminProduct(productId: bigint, input: ProductWriteInput) {
  const existing = await adminProductRepository.findById(productId);
  if (!existing) throw new AdminRouteError("NOT_FOUND", "Product not found");
  return mapAdminProduct(await adminProductRepository.update(productId, input));
}

export async function deleteAdminProduct(productId: bigint) {
  const existing = await adminProductRepository.findById(productId);
  if (!existing) throw new AdminRouteError("NOT_FOUND", "Product not found");
  await adminProductRepository.delete(productId);
}
