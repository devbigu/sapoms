import { NextRequest, NextResponse } from "next/server";
import { PRODUCT_NOTE_LIMIT, normalizeProductNote, normalizeSku } from "@/lib/orderProductNotes.mjs";
import { requireAuth } from "@/server/auth/session";
import { listProductNotes, PostgresOrderAnnotationError, upsertProductNote } from "@/lib/postgresOrderAnnotations";

export const runtime = "nodejs";

function safeText(value: unknown, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function pgError(error: unknown) {
  return error instanceof PostgresOrderAnnotationError
    ? NextResponse.json({ success: false, message: error.message }, { status: error.status })
    : null;
}

export async function GET(req: NextRequest) {
  try {
    const orderId = safeText(req.nextUrl.searchParams.get("orderId") || req.nextUrl.searchParams.get("order_id"), 80);
    const orderIds = safeText(req.nextUrl.searchParams.get("orderIds") || req.nextUrl.searchParams.get("order_ids"), 4000);
    const orderItemId = safeText(req.nextUrl.searchParams.get("orderItemId") || req.nextUrl.searchParams.get("order_item_id"), 80);
    if (!orderId && !orderIds && !orderItemId) {
      return NextResponse.json({ success: false, message: "orderId, orderIds, or orderItemId is required" }, { status: 400 });
    }

    const requestedIds = orderIds
      ? orderIds.split(",").map((id) => safeText(id, 80)).filter(Boolean).slice(0, 200)
      : orderId ? [orderId] : [];
    const actor = await requireAuth();
    const pgRows = await listProductNotes(actor, { orderIds: requestedIds, orderId, orderItemId });
    return NextResponse.json({ success: true, data: pgRows ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    console.error("[GET /api/order-product-notes]", error);
    const pg = pgError(error);
    if (pg) return pg;
    return NextResponse.json({ success: false, message: "Failed to load product notes" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const actor = await requireAuth();
    const pg = await upsertProductNote(actor, body);
    if (pg) {
      return NextResponse.json({ success: true, data: pg }, { status: 201, headers: { "Cache-Control": "no-store" } });
    }

    normalizeProductNote(body.note, PRODUCT_NOTE_LIMIT);
    normalizeSku(body.sku);
    return NextResponse.json({ success: false, message: "Product notes are available only for PostgreSQL orders." }, { status: 404 });
  } catch (error: unknown) {
    console.error("[POST /api/order-product-notes]", error);
    const pg = pgError(error);
    if (pg) return pg;
    return NextResponse.json({ success: false, message: "Failed to save product note" }, { status: 500 });
  }
}