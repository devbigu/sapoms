import { NextRequest, NextResponse } from "next/server";
import { adminListResponse } from "@/server/admin/admin-response";
import { adminErrorResponse } from "@/server/admin/admin-errors";
import { auditAdminAction, requireAdmin, requestIdFrom } from "@/server/admin/admin-route";
import { parseAdminStaffListInput, parseCreateAdminStaffInput } from "@/server/modules/admin/staff/staff.schemas";
import { listAdminStaff, createAdminStaff } from "@/server/modules/admin/staff/staff.service";

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
export async function POST(request: NextRequest) {
  try {
    const actor = await requireAdmin();
    const requestId = requestIdFrom(request);
    const input = parseCreateAdminStaffInput(await request.json());
    const item = await createAdminStaff(input, actor);
    await auditAdminAction({ actor, request, eventType: "ADMIN_STAFF_CREATED", route: "/api/admin/staff", requestId, targetId: item.id });
    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/admin/staff]", error);
    return adminErrorResponse(error, "Staff could not be created");
  }
}

