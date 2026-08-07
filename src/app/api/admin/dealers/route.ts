import { NextRequest, NextResponse } from "next/server";
import { adminListResponse, adminMutationResponse } from "@/server/admin/admin-response";
import { adminErrorResponse } from "@/server/admin/admin-errors";
import { auditAdminAction, requireAdmin, requestIdFrom } from "@/server/admin/admin-route";
import { parseAdminDealerListInput, parseCreateAdminDealerInput } from "@/server/modules/admin/dealers/dealers.schemas";
import { createAdminDealer, listAdminDealers } from "@/server/modules/admin/dealers/dealers.service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAdmin();
    const requestId = requestIdFrom(request);
    const input = parseAdminDealerListInput(request.nextUrl.searchParams);
    const result = await listAdminDealers(input);
    await auditAdminAction({ actor, request, eventType: "ADMIN_DEALERS_VIEWED", route: "/api/admin/dealers", requestId });
    return NextResponse.json(adminListResponse({ items: result.items, page: input.page, pageSize: input.pageSize, total: result.total }), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[GET /api/admin/dealers]", error);
    return adminErrorResponse(error, "Dealers are unavailable");
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAdmin();
    const input = parseCreateAdminDealerInput(await request.json());
    const data = await createAdminDealer(input, actor);
    return NextResponse.json(adminMutationResponse("Dealer created successfully", data), { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[POST /api/admin/dealers]", error);
    return adminErrorResponse(error, "Dealer creation failed");
  }
}