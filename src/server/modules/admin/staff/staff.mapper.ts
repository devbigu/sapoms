import type { AdminStaffRecord } from "./staff.types";

export function mapAdminStaff(record: AdminStaffRecord, detail = false) {
  const id = record.id.toString();
  const name = record.displayName || "";
  const userId = record.user.id.toString();
  const email = record.user.email || "";
  const designation = record.designation || "";
  const location = record.location || "";
  const staffRoleType = record.staffRoleType || "";
  const role = record.user.role;
  const salesRegion = record.salesRegion || "";
  const parentRsmId = record.parentRsmId?.toString() || "";
  const parentAsmId = record.parentAsmId?.toString() || "";

  return {
    id,
    userId,
    name,
    email,
    designation,
    location,
    staffRoleType,
    salesRegion,
    parentRsmId,
    parentAsmId,
    assignedStates: record.assignedStates ?? [],
    parentRsm: record.parentRsm ? {
      id: record.parentRsm.id.toString(),
      name: record.parentRsm.displayName,
      email: record.parentRsm.user.email,
      userId: record.parentRsm.user.id.toString(),
    } : null,
    parentAsm: record.parentAsm ? {
      id: record.parentAsm.id.toString(),
      name: record.parentAsm.displayName,
      email: record.parentAsm.user.email,
      userId: record.parentAsm.user.id.toString(),
    } : null,
    role,
    status: record.user.status,
    assignedDealerCount: 0,
    ...(detail ? { assignedDealers: [] } : {}),
    staff_id: id,
    staff_name: name,
    staff_email: email,
    staff_designation: designation,
    staff_location: location,
    staff_roletype: staffRoleType,
    sales_region: salesRegion,
    parent_rsm_id: parentRsmId,
    parent_asm_id: parentAsmId,
    assigned_states: record.assignedStates ?? [],
  };
}
