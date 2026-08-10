import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { requireAuth } from "@/server/auth/session";
import { hashPassword } from "@/server/auth/password";
import { mapDealerProfileAliases } from "@/server/modules/profiles/profile-aliases";

export const runtime = "nodejs";

function bodyText(body: Record<string, unknown>, keys: string[], max = 1000) {
  for (const key of keys) {
    const value = String(body[key] ?? "").trim();
    if (value) return value.slice(0, max);
  }
  return "";
}

async function loadDealer(dealerId: bigint) {
  return prisma.dealerProfile.findFirst({
    where: { id: dealerId, deletedAt: null },
    include: { user: { select: { email: true, username: true, status: true } } },
  });
}

export async function GET() {
  try {
    const actor = await requireAuth();
    if (actor.role !== "DEALER" || !actor.dealerId) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    const dealer = await loadDealer(actor.dealerId);
    if (!dealer) return NextResponse.json({ success: false, message: "Dealer profile not found" }, { status: 404 });
    return NextResponse.json({ success: true, status: true, data: mapDealerProfileAliases(dealer) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[GET /api/dealer/profile]", error);
    return NextResponse.json({ success: false, message: "Dealer profile unavailable" }, { status: 401 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const actor = await requireAuth();
    if (actor.role !== "DEALER" || !actor.dealerId) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    const body = await request.json().catch(() => ({}));
    const input = body && typeof body === "object" ? body as Record<string, unknown> : {};
    const password = bodyText(input, ["Dealer_Password", "password"], 200);
    await prisma.$transaction(async (tx) => {
      await tx.dealerProfile.update({
        where: { id: actor.dealerId },
        data: {
          businessName: bodyText(input, ["Dealer_Name", "name", "businessName"], 300),
          phone: bodyText(input, ["Dealer_Number", "phone"], 80) || null,
          city: bodyText(input, ["Dealer_City", "city"], 160) || null,
          address: bodyText(input, ["Dealer_Address", "address"], 1000) || null,
          pincode: bodyText(input, ["Dealer_Pincode", "pincode"], 40) || null,
        },
      });
      const userData: { email?: string; passwordHash?: string } = {};
      const email = bodyText(input, ["Dealer_Email", "email"], 300);
      if (email) userData.email = email;
      if (password) userData.passwordHash = await hashPassword(password);
      if (Object.keys(userData).length) await tx.user.update({ where: { id: actor.userId }, data: userData });
    });
    const dealer = await loadDealer(actor.dealerId);
    return NextResponse.json({ success: true, status: true, msg: "Dealer profile updated", data: dealer ? mapDealerProfileAliases(dealer) : null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[PATCH /api/dealer/profile]", error);
    return NextResponse.json({ success: false, message: "Dealer profile could not be updated" }, { status: 400 });
  }
}
