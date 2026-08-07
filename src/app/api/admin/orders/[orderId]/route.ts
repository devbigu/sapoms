import { NextRequest, NextResponse } from "next/server";
import { adminDetailResponse } from "@/server/admin/admin-response";
import { adminErrorResponse } from "@/server/admin/admin-errors";
import { auditAdminAction, parseBigIntRouteParam, requireAdmin, requestIdFrom } from "@/server/admin/admin-route";
import { getAdminOrder } from "@/server/modules/admin/orders/orders.service";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const actor = await requireAdmin();
    const requestId = requestIdFrom(request);
    const { orderId } = await params;
    const id = parseBigIntRouteParam(orderId, "orderId");
    const data = await getAdminOrder(id);
    await auditAdminAction({ actor, request, eventType: "ADMIN_ORDER_VIEWED", route: "/api/admin/orders/[orderId]", requestId, targetId: orderId });
    return NextResponse.json(adminDetailResponse(data), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[GET /api/admin/orders/[orderId]]", error);
    return adminErrorResponse(error, "Order is unavailable");
  }
}