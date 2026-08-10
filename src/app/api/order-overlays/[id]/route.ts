import { NextRequest, NextResponse } from "next/server";
import { invalidatePendingProductsCache } from "@/lib/pendingProducts";
import { requireAuth } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { findPostgresOrderByLookup } from "@/lib/postgresOrderAnnotations";
import { mapPostgresOrderItemToLegacy, mapPostgresOrderToLegacy, type PostgresOrderRecord } from "@/lib/postgresOrders";
import { mapPostgresOrderDispatchRecords } from "@/lib/postgresOrderDispatch";
import { ORDER_OVERLAY_VERSION, resolveEffectiveOrder, toSafeOverlay, type OrderOverlayDocument } from "@/lib/orderOverlays";
import {
  cancelPostgresOrder,
  normalizeFulfilmentStatus,
  PostgresOrderStatusError,
  updatePostgresOrderAcceptance,
  updatePostgresOrderFulfilment,
} from "@/lib/postgresOrderStatus";

export const runtime = "nodejs";

function safeText(value: unknown, max = 240) {
  return String(value ?? "").trim().slice(0, max);
}

function actorRole(role: string | null | undefined): "admin" | "staff" | "dealer" {
  if (role === "STAFF") return "staff";
  if (role === "DEALER") return "dealer";
  return "admin";
}

function overlayDoc(row: Awaited<ReturnType<typeof prisma.orderOverlay.findFirst>>, order: Awaited<ReturnType<typeof findPostgresOrderByLookup>>): OrderOverlayDocument | null {
  if (!row || !order) return null;
  const status = row.type === "cancel" || row.status === "cancelled" ? "cancelled" : "active";
  const createdAt = row.createdAt.toISOString();
  const updatedAt = row.updatedAt.toISOString();
  return {
    orderId: order.legacyPhpId || order.id.toString(),
    dealerId: order.dealerId.toString(),
    dealerName: order.dealer.businessName,
    assignedStaffId: order.assignedStaffId?.toString() ?? null,
    status,
    cancellation: status === "cancelled" ? {
      status: "cancelled",
      reason: row.reason ?? "",
      cancelledBy: { id: row.actorUserId?.toString() ?? "", role: actorRole(row.actorRole) },
      cancelledAt: createdAt,
    } : undefined,
    edits: [],
    latestRevision: 0,
    source: ORDER_OVERLAY_VERSION,
    createdAt,
    updatedAt,
  };
}

async function loadPostgresEffectiveContext(orderIdInput: string) {
  const order = await findPostgresOrderByLookup(orderIdInput);
  if (!order) return null;
  const orderId = order.legacyPhpId || order.id.toString();
  const [overlayRow, dispatchOrder] = await Promise.all([
    prisma.orderOverlay.findFirst({ where: { orderId: order.id }, orderBy: { updatedAt: "desc" } }),
    prisma.order.findUnique({
      where: { id: order.id },
      include: {
        dealer: { select: { id: true, businessName: true, dealerCode: true, phone: true, city: true, address: true, pincode: true, gstin: true, discountPercent: true } },
        assignedStaff: { select: { id: true, displayName: true } },
        items: { orderBy: { id: "asc" }, include: { dispatches: { orderBy: { createdAt: "asc" } } } },
      },
    }),
  ]);
  const originalOrder = mapPostgresOrderToLegacy(order as unknown as PostgresOrderRecord);
  const originalItems = order.items.map((item) => mapPostgresOrderItemToLegacy(item, order as unknown as PostgresOrderRecord));
  const overlay = overlayDoc(overlayRow, order);
  const dispatchRecords = dispatchOrder ? mapPostgresOrderDispatchRecords(dispatchOrder as any) : [];
  const effective = resolveEffectiveOrder({ orderId, originalOrder, originalItems, overlay, dispatchRecords });
  return { effective, overlay };
}

function errorResponse(error: unknown) {
  if (error instanceof PostgresOrderStatusError) {
    return NextResponse.json({ success: false, code: error.code, message: error.message }, { status: error.status });
  }
  return NextResponse.json({ success: false, code: "unexpected", message: String((error as Error)?.message ?? "Unable to process order overlay.") }, { status: 500 });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await loadPostgresEffectiveContext(id);
    if (!context) {
      return NextResponse.json({ success: false, message: "Order overlays are available only for PostgreSQL orders." }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: { ...context.effective, itemContract: "complete", overlay: toSafeOverlay(context.overlay) } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[GET /api/order-overlays/[id]]", error);
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authActor = await requireAuth();
    const { id } = await params;
    const body = await req.json();
    const action = safeText(body.action, 40);

    if (action === "mirror_acceptance") {
      const updated = await updatePostgresOrderAcceptance(id, authActor, "ACCEPTED");
      if (!updated) return NextResponse.json({ success: false, message: "Historical PHP orders are read-only for PostgreSQL status updates." }, { status: 409 });
      invalidatePendingProductsCache();
      return NextResponse.json({ success: true, data: updated });
    }

    if (action === "status") {
      const fulfilmentStatus = normalizeFulfilmentStatus(body.fulfilmentStatus ?? body.fulfilment_status ?? body.status);
      if (!fulfilmentStatus) return NextResponse.json({ success: false, message: "A valid fulfilment status is required." }, { status: 400 });
      const updated = await updatePostgresOrderFulfilment(id, authActor, fulfilmentStatus);
      if (!updated) return NextResponse.json({ success: false, message: "Historical PHP orders are read-only for PostgreSQL status updates." }, { status: 409 });
      invalidatePendingProductsCache();
      return NextResponse.json({ success: true, data: updated });
    }

    if (action === "decline") {
      const updated = await updatePostgresOrderAcceptance(id, authActor, "DECLINED");
      if (!updated) return NextResponse.json({ success: false, message: "Historical PHP orders are read-only for PostgreSQL status updates." }, { status: 409 });
      invalidatePendingProductsCache();
      return NextResponse.json({ success: true, data: updated });
    }

    if (action === "cancel") {
      const updated = await cancelPostgresOrder(id, authActor, body.reason);
      if (!updated) return NextResponse.json({ success: false, message: "Historical PHP orders are read-only for PostgreSQL cancellation." }, { status: 409 });
      invalidatePendingProductsCache();
      return NextResponse.json({ success: true, data: updated });
    }

    return NextResponse.json({ success: false, message: "Unsupported PostgreSQL overlay action." }, { status: 400 });
  } catch (error) {
    console.error("[POST /api/order-overlays/[id]]", error);
    return errorResponse(error);
  }
}