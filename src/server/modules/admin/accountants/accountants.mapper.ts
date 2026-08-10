import type { AdminAccountantRecord } from "./accountants.types";

export function mapAdminAccountant(record: AdminAccountantRecord) {
  const id = record.id.toString();
  const name = record.displayName || "";
  const email = record.user.email || "";
  const designation = record.designation || "";

  return {
    id,
    _id: id,
    name,
    email,
    phone: "",
    designation,
    role: "accountant",
    status: record.user.status,
    createdAt: record.user.createdAt.toISOString(),
  };
}
