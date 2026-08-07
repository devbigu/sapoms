import { AdminRouteError } from "@/server/admin/admin-errors";
import type { AdminActor } from "@/server/admin/admin.types";
import { adminProfileRepository } from "./profile.repository";
import { mapAdminProfile } from "./profile.mapper";
import type { AdminProfileUpdateInput } from "./profile.types";

export async function getAdminProfile(actor: AdminActor) {
  const record = await adminProfileRepository.getByUserId(actor.userId);
  if (!record) throw new AdminRouteError("NOT_FOUND", "Admin profile not found");
  return mapAdminProfile(record);
}

export async function updateAdminProfile(actor: AdminActor, input: AdminProfileUpdateInput, audit: { requestId: string }) {
  const record = await adminProfileRepository.update(actor, input, audit);
  return mapAdminProfile(record);
}