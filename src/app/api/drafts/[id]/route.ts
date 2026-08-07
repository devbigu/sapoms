import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { requireAuth } from "@/server/auth/session";
import { actorFromRequestHeaders, assertDealerScope, draftSnapshot, jsonValue, mapDraft, text } from "@/lib/postgresDiscountDrafts";

export const runtime = "nodejs";

async function getActor(req: NextRequest) {
  return await requireAuth().catch(() => actorFromRequestHeaders(req.headers));
}

function jsonError(error: any, fallback: string) {
  const status = Number(error?.status) || (error?.message === "Forbidden" ? 403 : 500);
  return NextResponse.json({ success: false, message: status >= 500 ? fallback : error.message }, { status });
}

async function scopedDraft(id: string, dealerId: bigint) {
  if (!/^\d+$/.test(id)) return null;
  return prisma.orderDraft.findFirst({ where: { id: BigInt(id), dealerId, status: "ACTIVE" } });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const actor = await getActor(req);
    const dealerId = actor?.role === "DEALER" && actor.dealerId ? actor.dealerId : BigInt(text(req.nextUrl.searchParams.get("dealer_id"), 80));
    assertDealerScope(actor, dealerId);
    const draft = await scopedDraft(id, dealerId);
    if (!draft) return NextResponse.json({ success: false, message: "Draft not found" }, { status: 404 });
    return NextResponse.json({ success: true, data: mapDraft(draft) });
  } catch (error) {
    console.error("[GET /api/drafts/[id]]", error);
    return jsonError(error, "Failed to load draft");
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const actor = await getActor(req);
    const body = await req.json();
    const dealerId = actor?.role === "DEALER" && actor.dealerId ? actor.dealerId : BigInt(text(body.dealer_id || body.dealerId, 80));
    assertDealerScope(actor, dealerId);
    const existing = await scopedDraft(id, dealerId);
    if (!existing) return NextResponse.json({ success: false, message: "Draft not found" }, { status: 404 });
    const currentSnapshot = existing.snapshot && typeof existing.snapshot === "object" ? existing.snapshot as Record<string, unknown> : {};
    const merged = draftSnapshot({ ...currentSnapshot, ...body });
    const updated = await prisma.orderDraft.update({
      where: { id: existing.id },
      data: {
        ...(body.name !== undefined ? { name: text(body.name, 160) } : {}),
        snapshot: jsonValue(merged),
        ...(body.approval_state !== undefined ? { approvalState: jsonValue(body.approval_state) } : {}),
      },
    });
    return NextResponse.json({ success: true, data: mapDraft(updated) });
  } catch (error) {
    console.error("[PUT /api/drafts/[id]]", error);
    return jsonError(error, "Failed to update draft");
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const actor = await getActor(req);
    const dealerId = actor?.role === "DEALER" && actor.dealerId ? actor.dealerId : BigInt(text(req.nextUrl.searchParams.get("dealer_id"), 80));
    assertDealerScope(actor, dealerId);
    const existing = await scopedDraft(id, dealerId);
    if (!existing) return NextResponse.json({ success: false, message: "Draft not found" }, { status: 404 });
    await prisma.orderDraft.update({ where: { id: existing.id }, data: { status: "CANCELLED" } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/drafts/[id]]", error);
    return jsonError(error, "Failed to delete draft");
  }
}