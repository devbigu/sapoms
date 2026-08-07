import { AdminRouteError } from "@/server/admin/admin-errors";
import { adminStaffRepository } from "./staff.repository";
import { mapAdminStaff } from "./staff.mapper";
import type { AdminStaffListInput } from "./staff.types";

export async function listAdminStaff(input: AdminStaffListInput) {
  const result = await adminStaffRepository.list(input);
  return { items: result.items.map((item) => mapAdminStaff(item)), total: result.total };
}

export async function getAdminStaff(staffId: bigint) {
  const record = await adminStaffRepository.findById(staffId);
  if (!record) throw new AdminRouteError("NOT_FOUND", "Staff member not found");
  return mapAdminStaff(record, true);
}