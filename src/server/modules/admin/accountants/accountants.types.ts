import type { AdminListInput } from "@/server/admin/admin.types";

export type AdminAccountantListInput = AdminListInput;

export type AdminAccountantRecord = {
  id: bigint;
  displayName: string;
  designation: string | null;
  user: { id: bigint; email: string; status: string };
};