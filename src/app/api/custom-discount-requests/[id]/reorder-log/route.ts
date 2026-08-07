import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { requireAuth } from "@/server/auth/session";
import { actorFromRequestHeaders, assertDealerScope, customDiscountInclude, mapCustomDiscount, text } from "@/lib/postgresDiscountDrafts";

export const runtime = "nodejs";

async function getActor(req: NextRequest) {
  return await requireAuth().catch(() => actorFromRequestHeaders(req.headers));
}

function jsonError(error: any) {
  const status = Number(error?.status) || (error?.message === "Forbidden" ? 403 : 500);
  return NextResponse.json({ success: false, message: status >= 500 ? "Failed to write reorder log" : error.message }, { status });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!/^\d+$/.test(id)) return NextResponse.json({ success: false, message: "Invalid id" }, { status: 400 });
    const actor = await getActor(req);
    const body = await req.json();
    const dealerId = actor?.role === "DEALER" && actor.dealerId ? actor.dealerId : BigInt(text(body.dealerId || body.dealer_id, 80));
    const orderId = text(body.orderId || body.order_id, 80);
    if (!orderId) return NextResponse.json({ success: false, message: "orderId is required" }, { status: 400 });

    const existing = await prisma.customDiscountRequest.findUnique({ where: { id: BigInt(id) }, include: customDiscountInclude });
    if (!existing) return NextResponse.json({ success: false, message: "Request not found" }, { status: 404 });
    assertDealerScope(actor, existing.dealerId);
    if (existing.dealerId !== dealerId) return NextResponse.json({ success: false, message: "Request belongs to another dealer" }, { status: 403 });
    if (existing.status !== "APPROVED" || !existing.allowReorder) return NextResponse.json({ success: false, message: "Reorder is not allowed" }, { status: 409 });

    const updated = await prisma.$transaction(async (tx) => {
      await tx.customDiscountReorderLog.create({ data: { requestId: existing.id, dealerId, orderId: BigInt(orderId) } });
      return tx.customDiscountRequest.findUniqueOrThrow({ where: { id: existing.id }, include: customDiscountInclude });
    });
    return NextResponse.json({ success: true, data: mapCustomDiscount(updated) });
  } catch (error) {
    console.error("[POST /api/custom-discount-requests/[id]/reorder-log]", error);
    return jsonError(error);
  }
}