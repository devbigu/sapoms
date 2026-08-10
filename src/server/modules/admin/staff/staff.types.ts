import type { AdminListInput } from "@/server/admin/admin.types";
import type { SalesRegion, UserRole, UserStatus } from "@prisma/client";

export type AdminStaffListInput = AdminListInput;
export type AdminStaffRole = Extract<UserRole, "STAFF" | "RSM" | "NSM">;
export type AdminCreateUserRole = Extract<UserRole, "NSM" | "RSM" | "STAFF">;

export type AdminStaffRecord = {
  id: bigint;
  displayName: string;
  designation: string | null;
  location: string | null;
  staffRoleType: string | null;
  salesRegion: SalesRegion | null;
  user: { id: bigint; email: string; username: string | null; status: string; role: UserRole };
};
export type CreateAdminStaffInput = {
  name: string;
  email: string;
  password: string;
  role: AdminCreateUserRole;
  designation?: string;
  location?: string;
  staffRoleType?: string;
  salesRegion?: SalesRegion;
  status?: UserStatus;
};

export type UpdateAdminStaffInput = {
  name?: string;
  email?: string;
  role?: AdminStaffRole;
  designation?: string;
  location?: string;
  staffRoleType?: string;
  salesRegion?: SalesRegion;
  status?: UserStatus;
};
