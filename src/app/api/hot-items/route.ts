import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { requireAuth } from "@/server/auth/session";

export const runtime = "nodejs";

type HotItem = {
  id: string;
  SKU: string;
  name: string;
  specs: string;
  image: string;
  badge: string;
  active: boolean;
};

type HotItemRow = Awaited<ReturnType<typeof loadHotItemRows>>[number];
type ResolvedHotItem = { item: HotItem; index: number; productId: bigint; variantId: bigint | null };

function safeText(value: unknown, max = 300) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizeItem(raw: unknown, index: number): HotItem | null {
  const candidate = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const SKU = safeText(candidate.SKU ?? candidate.sku, 120);
  const name = safeText(candidate.name ?? candidate.Name, 300);
  if (!SKU || !name) return null;

  return {
    id: safeText(candidate.id, 80) || `${Date.now()}-${index}`,
    SKU,
    name,
    specs: safeText(candidate.specs ?? candidate.Specs ?? candidate.specifications ?? candidate.Specifications ?? candidate.specification, 500),
    image: safeText(candidate.image, 1000),
    badge: safeText(candidate.badge, 80) || "Hot pick",
    active: candidate.active !== false,
  };
}

function toDoc(items: HotItem[], updatedAt?: string | null, isDefault = false) {
  return { items, updatedAt: updatedAt ?? null, isDefault };
}

function safeErrorResponse(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status, headers: { "Cache-Control": "no-store" } });
}

async function loadHotItemRows() {
  return prisma.hotItem.findMany({
    where: {
      product: { active: true },
      OR: [{ variantId: null }, { variant: { active: true } }],
    },
    include: { product: true, variant: true },
    orderBy: [{ position: "asc" }, { id: "asc" }],
  });
}

function rowSku(row: HotItemRow) {
  return row.variant?.sku || row.variant?.catalogueNumber || row.product.productCode || row.skuSnapshot;
}

function rowName(row: HotItemRow) {
  return row.product.name || row.nameSnapshot;
}

function rowSpecs(row: HotItemRow) {
  const parts = [row.variant?.unitName, row.variant?.packSize ? `${row.variant.packSize} pcs` : ""].filter(Boolean);
  return parts.join(" · ") || row.specsSnapshot;
}

function toHotItem(row: HotItemRow): HotItem {
  return {
    id: row.id.toString(),
    SKU: rowSku(row),
    name: rowName(row),
    specs: rowSpecs(row),
    image: row.product.imageUrl || row.imageSnapshot,
    badge: row.badge || "Hot pick",
    active: row.isActive,
  };
}

async function resolveProduct(input: HotItem) {
  const sku = input.SKU.trim();
  const variant = await prisma.productVariant.findFirst({
    where: {
      active: true,
      product: { active: true },
      OR: [{ sku }, { catalogueNumber: sku }],
    },
    include: { product: true },
  });
  if (variant) return { productId: variant.productId, variantId: variant.id };

  const product = await prisma.product.findFirst({
    where: { active: true, OR: [{ productCode: sku }, { name: { equals: input.name.trim(), mode: "insensitive" } }] },
    select: { id: true },
  });
  if (product) return { productId: product.id, variantId: null };

  return null;
}

export async function GET() {
  try {
    const rows = await loadHotItemRows();
    const items = rows.map(toHotItem);
    const updatedAt = rows[0]?.updatedAt?.toISOString() ?? null;
    return NextResponse.json({ success: true, data: toDoc(items, updatedAt, false) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("hot-items GET failed", error);
    return safeErrorResponse("Unable to load hot items");
  }
}

export async function PUT(req: NextRequest) {
  try {
    const actor = await requireAuth();
    if (actor.role !== "ADMIN") return safeErrorResponse("Forbidden", 403);

    const body: unknown = await req.json();
    const bodyCandidate = (body && typeof body === "object" ? body : {}) as { items?: unknown };
    const items = (Array.isArray(bodyCandidate.items) ? bodyCandidate.items : [])
      .slice(0, 50)
      .map(normalizeItem)
      .filter(Boolean) as HotItem[];

    const resolvedItems: ResolvedHotItem[] = [];
    const seen = new Set<string>();
    for (const [index, item] of items.entries()) {
      const resolved = await resolveProduct(item);
      if (!resolved) return safeErrorResponse(`Active PostgreSQL product not found for SKU ${item.SKU}`, 400);
      const key = `${resolved.productId.toString()}:${resolved.variantId?.toString() ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      resolvedItems.push({ item, index, ...resolved });
    }

    await prisma.$transaction(async (tx) => {
      await tx.hotItem.deleteMany({});
      if (resolvedItems.length) {
        await tx.hotItem.createMany({
          data: resolvedItems.map(({ item, index, productId, variantId }) => ({
            productId,
            variantId,
            position: index,
            isActive: item.active,
            badge: item.badge,
            skuSnapshot: item.SKU,
            nameSnapshot: item.name,
            specsSnapshot: item.specs,
            imageSnapshot: item.image,
            createdByUserId: actor.userId,
          })),
        });
      }
      await tx.authAuditLog.create({
        data: {
          sessionId: actor.sessionId,
          role: actor.role,
          eventType: "HOT_ITEMS_PUBLISHED",
          metadata: { count: resolvedItems.length, userId: actor.userId.toString() },
        },
      });
    });

    const rows = await loadHotItemRows();
    const savedItems = rows.map(toHotItem);
    const updatedAt = rows[0]?.updatedAt?.toISOString() ?? new Date().toISOString();
    return NextResponse.json({ success: true, data: toDoc(savedItems, updatedAt) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("hot-items PUT failed", error);
    if (error instanceof Error && error.message === "Unauthenticated") return safeErrorResponse("Unauthenticated", 401);
    return safeErrorResponse("Unable to save hot items");
  }
}
