import { NextRequest, NextResponse } from "next/server";
import { adminMutationResponse } from "@/server/admin/admin-response";
import { adminErrorResponse } from "@/server/admin/admin-errors";
import { parseBigIntRouteParam, requireAdmin } from "@/server/admin/admin-route";
import { parseUpdateDealerStatusInput } from "@/server/modules/admin/dealers/dealers.schemas";
import { updateAdminDealerStatus } from "@/server/modules/admin/dealers/dealers.service";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ dealerId: string }> }) {
  try {
    const actor = await requireAdmin();
    const { dealerId } = await params;
    const id = parseBigIntRouteParam(dealerId, "dealerId");
    const input = parseUpdateDealerStatusInput(await request.json());
    const data = await updateAdminDealerStatus(id, input, actor);
    return NextResponse.json(adminMutationResponse("Dealer status updated successfully", data), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[PATCH /api/admin/dealers/[dealerId]/status]", error);
    return adminErrorResponse(error, "Dealer status update failed");
  }
}