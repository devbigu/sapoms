import { randomUUID } from "crypto";
import type { NextRequest } from "next/server";
import { requireAuth, writeAuthAuditLog, type AuthActor } from "@/server/auth/session";
import type { AuthRole } from "@/server/auth/providers/types";
import { isAdminLike } from "@/server/auth/sales-scope";
import { AdminRouteError } from "./admin-errors";
import type { AdminActor } from "./admin.types";

export async function requireAdmin(): Promise<AdminActor> {
  const actor = await requireAuth();
  if (!isAdminLike(actor)) throw new Error("Forbidden");
  return actor as AdminActor;
}

export function requireRole(actor: AuthActor, roles: AuthRole[]) {
  if (!roles.includes(actor.role)) {
    throw new Error("Forbidden");
  }
}

export function requestIdFrom(request: NextRequest) {
  return request.headers.get("x-request-id")?.trim() || randomUUID();
}

export async function auditAdminAction(input: {
  actor: AdminActor;
  request: NextRequest;
  eventType: string;
  route: string;
  requestId: string;
  targetId?: string;
}) {
  await writeAuthAuditLog({
    sessionId: input.actor.sessionId,
    userId: input.actor.userId,
    role: input.actor.role,
    eventType: input.eventType,
    request: input.request,
    metadata: {
      route: input.route,
      requestId: input.requestId,
      ...(input.targetId ? { targetId: input.targetId } : {}),
    },
  });
}

export function parseBigIntRouteParam(value: string, label: string) {
  if (!/^\d+$/.test(value)) {
    throw new AdminRouteError("INVALID_REQUEST", `Invalid ${label}`);
  }
  return BigInt(value);
}

