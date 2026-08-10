import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/session";
import { createSummaryOverride, listSummaryOverrides, PostgresOrderAnnotationError } from "@/lib/postgresOrderAnnotations";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function GET(req: NextRequest) {
  try {
    const orderId = req.nextUrl.searchParams.get("order_id");
    const orderIds = req.nextUrl.searchParams.get("order_ids");
    if (!orderId && !orderIds) {
      return NextResponse.json({ success: false, message: "order_id or order_ids required" }, { status: 400 });
    }

    const requestedIds = orderIds
      ? orderIds.split(",").map((id) => id.trim()).filter(Boolean).slice(0, 200)
      : orderId ? [orderId] : [];
    const actor = await requireAuth();
    const pgRows = await listSummaryOverrides(actor, requestedIds);
    return NextResponse.json({ success: true, data: pgRows ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: unknown) {
    console.error("[GET /api/order-summary-overrides]", e);
    if (e instanceof PostgresOrderAnnotationError) return NextResponse.json({ success: false, message: e.message }, { status: e.status });
    return NextResponse.json({ success: false, message: errorMessage(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>;
    const actor = await requireAuth();
    const pgRow = await createSummaryOverride(actor, body);
    if (pgRow) return NextResponse.json({ success: true, data: pgRow }, { status: 201, headers: { "Cache-Control": "no-store" } });

    return NextResponse.json({ success: false, message: "Summary overrides are available only for PostgreSQL orders." }, { status: 404 });
  } catch (e: unknown) {
    console.error("[POST /api/order-summary-overrides]", e);
    if (e instanceof PostgresOrderAnnotationError) return NextResponse.json({ success: false, message: e.message }, { status: e.status });
    return NextResponse.json({ success: false, message: errorMessage(e) }, { status: 500 });
  }
}