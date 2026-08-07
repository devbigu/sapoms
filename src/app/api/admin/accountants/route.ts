import { NextRequest, NextResponse } from "next/server";
import { adminListResponse } from "@/server/admin/admin-response";
import { adminErrorResponse } from "@/server/admin/admin-errors";
import { auditAdminAction, requireAdmin, requestIdFrom } from "@/server/admin/admin-route";
import { parseAdminAccountantListInput } from "@/server/modules/admin/accountants/accountants.schemas";
import { listAdminAccountants } from "@/server/modules/admin/accountants/accountants.service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAdmin();
    const requestId = requestIdFrom(request);
    const input = parseAdminAccountantListInput(request.nextUrl.searchParams);
    const result = await listAdminAccountants(input);
    await auditAdminAction({ actor, request, eventType: "ADMIN_ACCOUNTANTS_VIEWED", route: "/api/admin/accountants", requestId });
    return NextResponse.json(adminListResponse({ items: result.items, page: input.page, pageSize: input.pageSize, total: result.total }), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[GET /api/admin/accountants]", error);
    return adminErrorResponse(error, "Accountants are unavailable");
  }
}