import type { AdminStaffRecord } from "./staff.types";

export function mapAdminStaff(record: AdminStaffRecord, detail = false) {
  const id = record.id.toString();
  const name = record.displayName || "";
  const email = record.user.email || "";
  const designation = record.designation || "";
  const location = record.location || "";
  const staffRoleType = record.staffRoleType || "";
  const role = record.user.role;
  const salesRegion = record.salesRegion || "";

  return {
    id,
    name,
    email,
    designation,
    location,
    staffRoleType,
    salesRegion,
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
  };
}
