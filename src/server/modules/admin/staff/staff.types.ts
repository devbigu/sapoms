import type { AdminListInput } from "@/server/admin/admin.types";

export type AdminStaffListInput = AdminListInput;

export type AdminStaffRecord = {
  id: bigint;
  displayName: string;
  designation: string | null;
  location: string | null;
  staffRoleType: string | null;
  user: { id: bigint; email: string; username: string | null; status: string };
};