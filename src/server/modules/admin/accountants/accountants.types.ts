import type { AdminListInput } from "@/server/admin/admin.types";

export type AdminAccountantListInput = AdminListInput;

export type AdminAccountantRecord = {
  id: bigint;
  userId: bigint;
  displayName: string;
  designation: string | null;
  user: { id: bigint; email: string; status: string; createdAt: Date };
};

export type AdminAccountantMutationInput = {
  name?: string;
  email?: string;
  password?: string;
  phone?: string;
  designation?: string;
  status?: "ACTIVE" | "INACTIVE" | "SUSPENDED";
};
