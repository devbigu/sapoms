import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { requireAuth } from "@/server/auth/session";
import { isStaffLike } from "@/server/auth/sales-scope";
import { hashPassword } from "@/server/auth/password";
import { mapStaffProfileAliases } from "@/server/modules/profiles/profile-aliases";

export const runtime = "nodejs";

function bodyText(body: Record<string, unknown>, keys: string[], max = 1000) { for (const key of keys) { const value = String(body[key] ?? "").trim(); if (value) return value.slice(0, max); } return ""; }
async function loadStaff(staffId: bigint) { return prisma.staffProfile.findUnique({ where: { id: staffId }, include: { user: { select: { email: true, username: true, status: true } } } }); }

export async function GET() {
  try {
    const actor = await requireAuth();
    if (!isStaffLike(actor) || !actor.staffId) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    const staff = await loadStaff(actor.staffId);
    if (!staff) return NextResponse.json({ success: false, message: "Staff profile not found" }, { status: 404 });
    return NextResponse.json({ success: true, status: true, data: mapStaffProfileAliases(staff) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[GET /api/staff/profile]", error);
    return NextResponse.json({ success: false, message: "Staff profile unavailable" }, { status: 401 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const actor = await requireAuth();
    if (!isStaffLike(actor) || !actor.staffId) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    const raw = await request.json().catch(() => ({}));
    const body = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    const password = bodyText(body, ["staff_password", "password"], 200);
    await prisma.$transaction(async (tx) => {
      await tx.staffProfile.update({ where: { id: actor.staffId }, data: { displayName: bodyText(body, ["staff_name", "staffname", "name"], 300), designation: bodyText(body, ["staff_designation", "designation"], 160) || null, location: bodyText(body, ["staff_location", "location"], 160) || null } });
      const userData: { passwordHash?: string } = {};
      if (password) userData.passwordHash = await hashPassword(password);
      if (Object.keys(userData).length) await tx.user.update({ where: { id: actor.userId }, data: userData });
    });
    const staff = await loadStaff(actor.staffId);
    return NextResponse.json({ success: true, status: true, msg: "Staff profile updated", data: staff ? mapStaffProfileAliases(staff) : null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[PATCH /api/staff/profile]", error);
    return NextResponse.json({ success: false, message: "Staff profile could not be updated" }, { status: 400 });
  }
}
