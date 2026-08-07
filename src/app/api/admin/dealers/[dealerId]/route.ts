import { NextRequest, NextResponse } from "next/server";
import { adminDetailResponse, adminMutationResponse } from "@/server/admin/admin-response";
import { adminErrorResponse } from "@/server/admin/admin-errors";
import { auditAdminAction, parseBigIntRouteParam, requireAdmin, requestIdFrom } from "@/server/admin/admin-route";
import { parseUpdateAdminDealerInput } from "@/server/modules/admin/dealers/dealers.schemas";
import { getAdminDealer, softDeleteAdminDealer, updateAdminDealer } from "@/server/modules/admin/dealers/dealers.service";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ dealerId: string }> }) {
  try {
    const actor = await requireAdmin();
    const requestId = requestIdFrom(request);
    const { dealerId } = await params;
    const id = parseBigIntRouteParam(dealerId, "dealerId");
    const data = await getAdminDealer(id);
    await auditAdminAction({ actor, request, eventType: "ADMIN_DEALER_VIEWED", route: "/api/admin/dealers/[dealerId]", requestId, targetId: dealerId });
    return NextResponse.json(adminDetailResponse(data), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[GET /api/admin/dealers/[dealerId]]", error);
    return adminErrorResponse(error, "Dealer is unavailable");
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ dealerId: string }> }) {
  try {
    const actor = await requireAdmin();
    const { dealerId } = await params;
    const id = parseBigIntRouteParam(dealerId, "dealerId");
    const input = parseUpdateAdminDealerInput(await request.json());
    const data = await updateAdminDealer(id, input, actor);
    return NextResponse.json(adminMutationResponse("Dealer updated successfully", data), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[PATCH /api/admin/dealers/[dealerId]]", error);
    return adminErrorResponse(error, "Dealer update failed");
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ dealerId: string }> }) {
  try {
    const actor = await requireAdmin();
    const { dealerId } = await params;
    const id = parseBigIntRouteParam(dealerId, "dealerId");
    await softDeleteAdminDealer(id, actor);
    return NextResponse.json(adminMutationResponse("Dealer deleted successfully"), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[DELETE /api/admin/dealers/[dealerId]]", error);
    return adminErrorResponse(error, "Dealer deletion failed");
  }
}