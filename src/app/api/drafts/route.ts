import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { requireAuth } from "@/server/auth/session";
import { actorFromRequestHeaders, assertDealerScope, dealerExists, draftSnapshot, jsonValue, mapDraft, text } from "@/lib/postgresDiscountDrafts";

export const runtime = "nodejs";

async function getActor(req: NextRequest) {
  return await requireAuth().catch(() => actorFromRequestHeaders(req.headers));
}

function jsonError(error: any, fallback: string) {
  const status = Number(error?.status) || (error?.message === "Forbidden" ? 403 : 500);
  return NextResponse.json({ success: false, message: status >= 500 ? fallback : error.message }, { status });
}

export async function GET(req: NextRequest) {
  try {
    const actor = await getActor(req);
    const dealerId = actor?.role === "DEALER" && actor.dealerId ? actor.dealerId : BigInt(text(req.nextUrl.searchParams.get("dealer_id"), 80));
    assertDealerScope(actor, dealerId);
    if (req.nextUrl.searchParams.get("count") === "1") {
      const count = await prisma.orderDraft.count({ where: { dealerId, status: "ACTIVE" } });
      return NextResponse.json({ success: true, count });
    }
    const rows = await prisma.orderDraft.findMany({ where: { dealerId, status: "ACTIVE" }, orderBy: { updatedAt: "desc" } });
    return NextResponse.json({ success: true, data: rows.map(mapDraft) });
  } catch (error) {
    console.error("[GET /api/drafts]", error);
    return jsonError(error, "Failed to load drafts");
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await getActor(req);
    const body = await req.json();
    const dealerId = actor?.role === "DEALER" && actor.dealerId ? actor.dealerId : BigInt(text(body.dealer_id || body.dealerId, 80));
    assertDealerScope(actor, dealerId);
    await dealerExists(dealerId);
    if (!text(body.name, 160) || !Array.isArray(body.rows)) return NextResponse.json({ success: false, message: "dealer_id, name, and rows are required" }, { status: 400 });
    const created = await prisma.orderDraft.create({
      data: {
        dealerId,
        name: text(body.name, 160),
        snapshot: jsonValue(draftSnapshot(body)),
        approvalState: body.approval_state === undefined ? undefined : jsonValue(body.approval_state),
      },
    });
    return NextResponse.json({ success: true, data: mapDraft(created) }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/drafts]", error);
    return jsonError(error, "Failed to create draft");
  }
}