import type { Prisma, SalesRegion } from "@prisma/client";
import type { AuthActor } from "@/server/auth/session";

export const SALES_REGIONS = ["NORTH", "SOUTH", "EAST", "WEST"] as const;
export type SalesRegionCode = typeof SALES_REGIONS[number];

export function isSalesRegion(value: unknown): value is SalesRegionCode {
  return typeof value === "string" && (SALES_REGIONS as readonly string[]).includes(value.toUpperCase());
}

export function normalizeSalesRegion(value: unknown): SalesRegionCode | undefined {
  if (value === undefined || value === null || String(value).trim() === "") return undefined;
  const upper = String(value).trim().toUpperCase();
  return isSalesRegion(upper) ? upper : undefined;
}

export function isAdminLike(actor: Pick<AuthActor, "role">) {
  return actor.role === "ADMIN" || actor.role === "NSM";
}

export function isRsm(actor: Pick<AuthActor, "role">) {
  return actor.role === "RSM";
}

export async function resolveActorSalesRegion(actor: Pick<AuthActor, "userId" | "role">, prisma: Pick<Prisma.TransactionClient, "staffProfile">): Promise<SalesRegion | null> {
  if (actor.role !== "RSM") return null;
  const profile = await prisma.staffProfile.findUnique({ where: { userId: actor.userId }, select: { salesRegion: true } });
  if (!profile?.salesRegion) throw Object.assign(new Error("RSM region is not configured"), { status: 403 });
  return profile.salesRegion;
}

export async function resolveSalesScope(actor: Pick<AuthActor, "userId" | "role">, requestedRegion: unknown, prisma: Pick<Prisma.TransactionClient, "staffProfile">) {
  const normalized = normalizeSalesRegion(requestedRegion);
  if (actor.role === "RSM") {
    const region = await resolveActorSalesRegion(actor, prisma);
    if (normalized && normalized !== region) throw Object.assign(new Error("RSM cannot access another region"), { status: 403 });
    return { scope: "REGION" as const, region };
  }
  if (isAdminLike(actor) || actor.role === "ACCOUNTANT") {
    return normalized ? { scope: "REGION" as const, region: normalized } : { scope: "ALL" as const, region: null };
  }
  return { scope: "OWN" as const, region: null };
}

export async function buildDealerRegionWhere(actor: Pick<AuthActor, "userId" | "role">, requestedRegion: unknown, prisma: Pick<Prisma.TransactionClient, "staffProfile">): Promise<Prisma.DealerProfileWhereInput> {
  const scope = await resolveSalesScope(actor, requestedRegion, prisma);
  return scope.scope === "REGION" && scope.region ? { region: scope.region } : {};
}

export async function buildOrderRegionWhere(actor: Pick<AuthActor, "userId" | "role">, requestedRegion: unknown, prisma: Pick<Prisma.TransactionClient, "staffProfile">): Promise<Prisma.OrderWhereInput> {
  const scope = await resolveSalesScope(actor, requestedRegion, prisma);
  return scope.scope === "REGION" && scope.region ? { dealer: { region: scope.region } } : {};
}
