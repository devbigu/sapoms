import { AdminRouteError } from "@/server/admin/admin-errors";
import { adminAccountantRepository } from "./accountants.repository";
import { mapAdminAccountant } from "./accountants.mapper";
import type { AdminAccountantListInput } from "./accountants.types";

export async function listAdminAccountants(input: AdminAccountantListInput) {
  const result = await adminAccountantRepository.list(input);
  return { items: result.items.map(mapAdminAccountant), total: result.total };
}

export async function getAdminAccountant(accountantId: bigint) {
  const record = await adminAccountantRepository.findById(accountantId);
  if (!record) throw new AdminRouteError("NOT_FOUND", "Accountant not found");
  return mapAdminAccountant(record);
}