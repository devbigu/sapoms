import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { requireAuth } from "@/server/auth/session";
import { mapDealerProfileAliases } from "@/server/modules/profiles/profile-aliases";

export const runtime = "nodejs";

export async function GET() {
  try {
    const actor = await requireAuth();
    if (!(actor.role === "STAFF" || actor.role === "RSM") || !actor.staffId) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    const rows = await prisma.dealerStaffAssignment.findMany({
      where: { staffId: actor.staffId, active: true, removedAt: null, dealer: { deletedAt: null, user: { status: "ACTIVE" } } },
      include: { dealer: { include: { user: { select: { email: true, username: true, status: true } } } } },
      orderBy: { assignedAt: "desc" },
    });
    return NextResponse.json({ success: true, status: true, data: rows.map((row) => mapDealerProfileAliases(row.dealer, actor.displayName)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[GET /api/staff/dealers]", error);
    return NextResponse.json({ success: false, message: "Assigned dealers unavailable" }, { status: 401 });
  }
}
