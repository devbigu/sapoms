import { NextRequest, NextResponse } from "next/server";
import { adminListResponse } from "@/server/admin/admin-response";
import { adminErrorResponse } from "@/server/admin/admin-errors";
import { auditAdminAction, requireAdmin, requestIdFrom } from "@/server/admin/admin-route";
import { parseAdminProductListInput } from "@/server/modules/admin/products/products.schemas";
import { listAdminProducts } from "@/server/modules/admin/products/products.service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAdmin();
    const requestId = requestIdFrom(request);
    const input = parseAdminProductListInput(request.nextUrl.searchParams);
    const result = await listAdminProducts(input);
    await auditAdminAction({ actor, request, eventType: "ADMIN_PRODUCTS_VIEWED", route: "/api/admin/products", requestId });
    return NextResponse.json(adminListResponse({ items: result.items, page: input.page, pageSize: input.pageSize, total: result.total }), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[GET /api/admin/products]", error);
    return adminErrorResponse(error, "Products are unavailable");
  }
}