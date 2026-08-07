import { NextRequest, NextResponse } from "next/server";
import { adminDetailResponse } from "@/server/admin/admin-response";
import { adminErrorResponse } from "@/server/admin/admin-errors";
import { auditAdminAction, parseBigIntRouteParam, requireAdmin, requestIdFrom } from "@/server/admin/admin-route";
import { getAdminStaff } from "@/server/modules/admin/staff/staff.service";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ staffId: string }> }) {
  try {
    const actor = await requireAdmin();
    const requestId = requestIdFrom(request);
    const { staffId } = await params;
    const id = parseBigIntRouteParam(staffId, "staffId");
    const data = await getAdminStaff(id);
    await auditAdminAction({ actor, request, eventType: "ADMIN_STAFF_MEMBER_VIEWED", route: "/api/admin/staff/[staffId]", requestId, targetId: staffId });
    return NextResponse.json(adminDetailResponse(data), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[GET /api/admin/staff/[staffId]]", error);
    return adminErrorResponse(error, "Staff member is unavailable");
  }
}