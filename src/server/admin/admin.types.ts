import type { AuthActor } from "@/server/auth/session";

export type AdminActor = AuthActor & { role: "ADMIN" | "NSM" };

export type AdminListInput = {
  page: number;
  pageSize: number;
  search: string;
};

export type AdminRouteContext = {
  actor: AdminActor;
  route: string;
  requestId: string;
};
