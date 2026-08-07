import { NextRequest, NextResponse } from "next/server";
import { adminDetailResponse } from "@/server/admin/admin-response";
import { adminErrorResponse } from "@/server/admin/admin-errors";
import { auditAdminAction, parseBigIntRouteParam, requireAdmin, requestIdFrom } from "@/server/admin/admin-route";
import { getAdminAccountant } from "@/server/modules/admin/accountants/accountants.service";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ accountantId: string }> }) {
  try {
    const actor = await requireAdmin();
    const requestId = requestIdFrom(request);
    const { accountantId } = await params;
    const id = parseBigIntRouteParam(accountantId, "accountantId");
    const data = await getAdminAccountant(id);
    await auditAdminAction({ actor, request, eventType: "ADMIN_ACCOUNTANT_VIEWED", route: "/api/admin/accountants/[accountantId]", requestId, targetId: accountantId });
    return NextResponse.json(adminDetailResponse(data), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[GET /api/admin/accountants/[accountantId]]", error);
    return adminErrorResponse(error, "Accountant is unavailable");
  }
}