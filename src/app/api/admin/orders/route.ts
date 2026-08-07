import { NextRequest, NextResponse } from "next/server";
import { adminListResponse } from "@/server/admin/admin-response";
import { adminErrorResponse } from "@/server/admin/admin-errors";
import { auditAdminAction, requireAdmin, requestIdFrom } from "@/server/admin/admin-route";
import { parseAdminOrderListInput } from "@/server/modules/admin/orders/orders.schemas";
import { listAdminOrders } from "@/server/modules/admin/orders/orders.service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAdmin();
    const requestId = requestIdFrom(request);
    const input = parseAdminOrderListInput(request.nextUrl.searchParams);
    const result = await listAdminOrders(input);
    await auditAdminAction({ actor, request, eventType: "ADMIN_ORDERS_VIEWED", route: "/api/admin/orders", requestId });
    return NextResponse.json(adminListResponse({ items: result.items, page: input.page, pageSize: input.pageSize, total: result.total }), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[GET /api/admin/orders]", error);
    return adminErrorResponse(error, "Orders are unavailable");
  }
}