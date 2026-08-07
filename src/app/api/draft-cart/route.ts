import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { requireAuth } from "@/server/auth/session";
import { actorFromRequestHeaders, assertDealerScope, jsonValue, text } from "@/lib/postgresDiscountDrafts";

export const runtime = "nodejs";

async function getActor(req: NextRequest) {
  return await requireAuth().catch(() => actorFromRequestHeaders(req.headers));
}

function jsonError(error: any, fallback: string) {
  const status = Number(error?.status) || (error?.message === "Forbidden" ? 403 : 500);
  return NextResponse.json({ success: false, message: status >= 500 ? fallback : error.message }, { status });
}

function mapCart(row: any) {
  if (!row) return null;
  return {
    id: row.id.toString(),
    _id: row.id.toString(),
    dealer_id: row.dealerId.toString(),
    dealerId: row.dealerId.toString(),
    items: row.items ?? [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  try {
    const actor = await getActor(req);
    const dealerId = actor?.role === "DEALER" && actor.dealerId ? actor.dealerId : BigInt(text(req.nextUrl.searchParams.get("dealer_id"), 80));
    assertDealerScope(actor, dealerId);
    const cart = await prisma.draftCart.findUnique({ where: { dealerId } });
    return NextResponse.json({ success: true, data: mapCart(cart) });
  } catch (error) {
    console.error("[GET /api/draft-cart]", error);
    return jsonError(error, "Failed to load draft cart");
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await getActor(req);
    const body = await req.json();
    const dealerId = actor?.role === "DEALER" && actor.dealerId ? actor.dealerId : BigInt(text(body.dealer_id || body.dealerId, 80));
    assertDealerScope(actor, dealerId);
    if (!Array.isArray(body.items)) return NextResponse.json({ success: false, message: "dealer_id and items array required" }, { status: 400 });
    const cart = await prisma.draftCart.upsert({
      where: { dealerId },
      create: { dealerId, items: jsonValue(body.items) },
      update: { items: jsonValue(body.items) },
    });
    return NextResponse.json({ success: true, data: mapCart(cart) });
  } catch (error) {
    console.error("[POST /api/draft-cart]", error);
    return jsonError(error, "Failed to save draft cart");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const actor = await getActor(req);
    const dealerId = actor?.role === "DEALER" && actor.dealerId ? actor.dealerId : BigInt(text(req.nextUrl.searchParams.get("dealer_id"), 80));
    assertDealerScope(actor, dealerId);
    await prisma.draftCart.deleteMany({ where: { dealerId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/draft-cart]", error);
    return jsonError(error, "Failed to clear draft cart");
  }
}