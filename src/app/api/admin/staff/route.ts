import { NextRequest, NextResponse } from "next/server";
import { adminListResponse } from "@/server/admin/admin-response";
import { adminErrorResponse } from "@/server/admin/admin-errors";
import { auditAdminAction, requireAdmin, requestIdFrom } from "@/server/admin/admin-route";
import { parseAdminStaffListInput } from "@/server/modules/admin/staff/staff.schemas";
import { listAdminStaff } from "@/server/modules/admin/staff/staff.service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAdmin();
    const requestId = requestIdFrom(request);
    const input = parseAdminStaffListInput(request.nextUrl.searchParams);
    const result = await listAdminStaff(input);
    await auditAdminAction({ actor, request, eventType: "ADMIN_STAFF_VIEWED", route: "/api/admin/staff", requestId });
    return NextResponse.json(adminListResponse({ items: result.items, page: input.page, pageSize: input.pageSize, total: result.total }), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[GET /api/admin/staff]", error);
    return adminErrorResponse(error, "Staff is unavailable");
  }
}