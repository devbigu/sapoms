import type { AdminListInput } from "@/server/admin/admin.types";
import type { SalesRegion, UserRole, UserStatus } from "@prisma/client";

export type AdminStaffListInput = AdminListInput;
export type AdminStaffRole = Extract<UserRole, "STAFF" | "RSM" | "ASM" | "NSM">;
export type AdminCreateUserRole = Extract<UserRole, "NSM" | "RSM" | "ASM" | "STAFF">;

export type AdminStaffRecord = {
  id: bigint;
  displayName: string;
  designation: string | null;
  location: string | null;
  staffRoleType: string | null;
  salesRegion: SalesRegion | null;
  parentRsmId: bigint | null;
  parentAsmId: bigint | null;
  assignedStates: string[];
  parentRsm?: { id: bigint; displayName: string; user: { id: bigint; email: string } } | null;
  parentAsm?: { id: bigint; displayName: string; user: { id: bigint; email: string } } | null;
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
  parentRsmId?: string;
  parentAsmId?: string;
  assignedStates?: string[];
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
  parentRsmId?: string;
  parentAsmId?: string;
  assignedStates?: string[];
  status?: UserStatus;
};
