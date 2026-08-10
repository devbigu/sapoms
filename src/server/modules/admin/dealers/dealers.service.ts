import { AdminRouteError } from "@/server/admin/admin-errors";
import { adminDealerRepository } from "./dealers.repository";
import { mapAdminDealer, mapAdminDealerStaffAssignment } from "./dealers.mapper";
import type { AdminDealerListInput, AuthActor, CreateAdminDealerInput, UpdateAdminDealerInput, UpdateDealerStatusInput } from "./dealers.types";

export async function listAdminDealers(input: AdminDealerListInput) {
  const result = await adminDealerRepository.list(input);
  return { items: result.items.map(mapAdminDealer), total: result.total };
}

export async function getAdminDealer(dealerId: bigint) {
  const record = await adminDealerRepository.findById(dealerId);
  if (!record) throw new AdminRouteError("NOT_FOUND", "Dealer not found", { code: "DEALER_NOT_FOUND" });
  return mapAdminDealer(record);
}

export async function createAdminDealer(input: CreateAdminDealerInput, actor: AuthActor, tx?: Parameters<typeof adminDealerRepository.create>[2]) {
  return mapAdminDealer(await adminDealerRepository.create(input, actor, tx));
}

export async function updateAdminDealer(dealerId: bigint, input: UpdateAdminDealerInput, actor: AuthActor) {
  return mapAdminDealer(await adminDealerRepository.update(dealerId, input, actor));
}

export async function updateAdminDealerStatus(dealerId: bigint, input: UpdateDealerStatusInput, actor: AuthActor) {
  return mapAdminDealer(await adminDealerRepository.updateStatus(dealerId, input, actor));
}

export async function softDeleteAdminDealer(dealerId: bigint, actor: AuthActor) {
  await adminDealerRepository.softDelete(dealerId, actor);
}

export async function getAdminDealerStaffAssignments(dealerId: bigint) {
  return (await adminDealerRepository.getStaffAssignments(dealerId)).map(mapAdminDealerStaffAssignment);
}

export async function replaceAdminDealerStaffAssignments(dealerId: bigint, staffIds: bigint[], actor: AuthActor, rsmUserId?: bigint) {
  return (await adminDealerRepository.replaceStaffAssignments(dealerId, staffIds, actor, rsmUserId)).map(mapAdminDealerStaffAssignment);
}
