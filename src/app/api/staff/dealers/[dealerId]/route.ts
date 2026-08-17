import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { requireAuth } from "@/server/auth/session";
import { isStaffLike } from "@/server/auth/sales-scope";
import { mapDealerProfileAliases } from "@/server/modules/profiles/profile-aliases";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ dealerId: string }> }) {
  try {
    const actor = await requireAuth();
    if (!isStaffLike(actor) || !actor.staffId) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    const { dealerId } = await params;
    if (!/^\d+$/.test(dealerId)) return NextResponse.json({ success: false, message: "Invalid dealer" }, { status: 400 });
    const assignment = await prisma.dealerStaffAssignment.findFirst({
      where: { staffId: actor.staffId, dealerId: BigInt(dealerId), active: true, removedAt: null, dealer: { deletedAt: null, user: { status: "ACTIVE" } } },
      include: { dealer: { include: { user: { select: { email: true, username: true, status: true } } } } },
    });
    if (!assignment) return NextResponse.json({ success: false, message: "Dealer not assigned to this staff account" }, { status: 404 });
    return NextResponse.json({ success: true, status: true, data: mapDealerProfileAliases(assignment.dealer, actor.displayName) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[GET /api/staff/dealers/[dealerId]]", error);
    return NextResponse.json({ success: false, message: "Assigned dealer unavailable" }, { status: 401 });
  }
}
