import { AdminRouteError } from "@/server/admin/admin-errors";
import { AccountantEmailConflictError, adminAccountantRepository } from "./accountants.repository";
import { mapAdminAccountant } from "./accountants.mapper";
import type { AdminAccountantListInput, AdminAccountantMutationInput } from "./accountants.types";

export async function listAdminAccountants(input: AdminAccountantListInput) {
  const result = await adminAccountantRepository.list(input);
  return { items: result.items.map(mapAdminAccountant), total: result.total };
}

export async function getAdminAccountant(accountantId: bigint) {
  const record = await adminAccountantRepository.findById(accountantId);
  if (!record) throw new AdminRouteError("NOT_FOUND", "Accountant not found");
  return mapAdminAccountant(record);
}

function handleMutationError(error: unknown): never {
  if (error instanceof AccountantEmailConflictError) throw new AdminRouteError("CONFLICT", error.message);
  throw error;
}

export async function createAdminAccountant(input: Required<Pick<AdminAccountantMutationInput, "name" | "email" | "password">> & AdminAccountantMutationInput) {
  try {
    return mapAdminAccountant(await adminAccountantRepository.create(input));
  } catch (error) {
    handleMutationError(error);
  }
}

export async function updateAdminAccountant(accountantId: bigint, input: AdminAccountantMutationInput) {
  try {
    const record = await adminAccountantRepository.update(accountantId, input);
    if (!record) throw new AdminRouteError("NOT_FOUND", "Accountant not found");
    return mapAdminAccountant(record);
  } catch (error) {
    handleMutationError(error);
  }
}

export async function deactivateAdminAccountant(accountantId: bigint) {
  const record = await adminAccountantRepository.deactivate(accountantId);
  if (!record) throw new AdminRouteError("NOT_FOUND", "Accountant not found");
  return mapAdminAccountant(record);
}
