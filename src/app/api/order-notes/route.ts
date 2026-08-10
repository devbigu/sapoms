import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/session";
import { listOrderNotes, PostgresOrderAnnotationError, upsertOrderNote } from "@/lib/postgresOrderAnnotations";

function errorResponse(error: unknown) {
  const status = error instanceof PostgresOrderAnnotationError
    ? error.status
    : /Unauthenticated|Invalid token|Session is not active|User is not active/i.test(String((error as Error)?.message ?? ""))
      ? 401
      : 500;
  return NextResponse.json(
    { success: false, message: status === 401 ? "Unauthenticated" : String((error as Error)?.message ?? "Unable to process order notes.") },
    { status },
  );
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
    const rows = await listOrderNotes(actor, requestedIds);
    return NextResponse.json({ success: true, data: rows ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[GET /api/order-notes]", error);
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const actor = await requireAuth();
    const saved = await upsertOrderNote(actor, body);
    if (!saved) {
      return NextResponse.json({ success: false, message: "Order notes are available only for PostgreSQL orders." }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: saved }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[POST /api/order-notes]", error);
    return errorResponse(error);
  }
}