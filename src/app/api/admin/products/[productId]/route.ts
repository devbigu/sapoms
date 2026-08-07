import { NextRequest, NextResponse } from "next/server";
import { adminDetailResponse } from "@/server/admin/admin-response";
import { adminErrorResponse } from "@/server/admin/admin-errors";
import { auditAdminAction, parseBigIntRouteParam, requireAdmin, requestIdFrom } from "@/server/admin/admin-route";
import { getAdminProduct } from "@/server/modules/admin/products/products.service";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
  try {
    const actor = await requireAdmin();
    const requestId = requestIdFrom(request);
    const { productId } = await params;
    const id = parseBigIntRouteParam(productId, "productId");
    const data = await getAdminProduct(id);
    await auditAdminAction({ actor, request, eventType: "ADMIN_PRODUCT_VIEWED", route: "/api/admin/products/[productId]", requestId, targetId: productId });
    return NextResponse.json(adminDetailResponse(data), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[GET /api/admin/products/[productId]]", error);
    return adminErrorResponse(error, "Product is unavailable");
  }
}