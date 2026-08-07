import type { AdminRouteContext } from "@/server/admin/admin.types";

export type AdminProfileUpdateInput = {
  name?: string;
  email?: string;
  phone?: string;
  imageUrl?: string;
  currentPassword?: string;
  newPassword?: string;
};

export type AdminProfileRecord = {
  id: bigint;
  displayName: string;
  phone: string | null;
  imageUrl: string | null;
  user: {
    id: bigint;
    email: string;
    role: string;
    passwordHash?: string;
  };
};

export type AdminProfileContext = AdminRouteContext;