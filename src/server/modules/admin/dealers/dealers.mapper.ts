import type { AdminDealerRecord, AdminDealerStaffAssignment } from "./dealers.types";

function decimalToString(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function moneyToString(value: bigint | null | undefined) {
  return value === null || value === undefined ? "" : value.toString();
}

export function mapAdminDealerStaffAssignment(record: AdminDealerStaffAssignment) {
  return {
    assignmentId: record.id.toString(),
    staffId: record.staffId.toString(),
    id: record.staffId.toString(),
    name: record.staff.displayName || "",
    email: record.staff.user.email || "",
    designation: record.staff.designation || "",
    active: record.active,
    assignedAt: record.assignedAt.toISOString(),
  };
}

export function mapAdminDealer(record: AdminDealerRecord) {
  const id = record.id.toString();
  const businessName = record.businessName || "";
  const email = record.user.email || "";
  const phone = record.phone || "";
  const city = record.city || "";
  const state = record.state || "";
  const address = record.address || "";
  const pincode = record.pincode || "";
  const dealerCode = record.dealerCode || "";
  const discount = decimalToString(record.discountPercent);
  const creditDays = record.creditDays ?? 0;
  const creditLimitPaise = moneyToString(record.creditLimitPaise);
  const gstin = record.gstin || "";
  const assignedStaff = (record.staffAssignments ?? [])
    .filter((assignment) => assignment.active && !assignment.staff.user.deletedAt && assignment.staff.user.status === "ACTIVE")
    .map(mapAdminDealerStaffAssignment);
  const assignedstaff = assignedStaff.map((staff) => staff.staffId).join(",");
  const staffname = assignedStaff.map((staff) => staff.name).filter(Boolean).join(", ");

  return {
    id,
    dealerCode,
    businessName,
    email,
    phone,
    city,
    state,
    address,
    pincode,
    gstin,
    discountPercent: discount,
    creditDays,
    creditLimitPaise,
    status: record.user.status,
    assignedStaff,
    Dealer_Id: id,
    Dealer_Name: businessName,
    Dealer_Email: email,
    Dealer_Number: phone,
    Dealer_City: city,
    Dealer_Address: address,
    Dealer_Pincode: pincode,
    Dealer_Dealercode: dealerCode,
    Dealer_Username: record.user.username || email,
    Dealer_Image: record.imageUrl || "",
    Dealer_Notes: "",
    discount,
    gst: gstin,
    creditdays: String(creditDays),
    currentlimit: creditLimitPaise,
    annualtarget: "",
    assignedstaff,
    staffname,
  };
}