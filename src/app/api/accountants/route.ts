import { NextRequest, NextResponse } from "next/server";
import { adminListResponse, adminMutationResponse } from "@/server/admin/admin-response";
import { adminErrorResponse } from "@/server/admin/admin-errors";
import { requireAdmin } from "@/server/admin/admin-route";
import { parseAdminAccountantListInput, parseCreateAdminAccountantInput } from "@/server/modules/admin/accountants/accountants.schemas";
import { createAdminAccountant, listAdminAccountants } from "@/server/modules/admin/accountants/accountants.service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const input = parseAdminAccountantListInput(request.nextUrl.searchParams);
    const result = await listAdminAccountants(input);
    return NextResponse.json(adminListResponse({ items: result.items, page: input.page, pageSize: input.pageSize, total: result.total }), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[GET /api/accountants]", error);
    return adminErrorResponse(error, "Accountants are unavailable");
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const input = await parseCreateAdminAccountantInput(request);
    const data = await createAdminAccountant(input);
    return NextResponse.json(adminMutationResponse("Accountant created", data), { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[POST /api/accountants]", error);
    return adminErrorResponse(error, "Accountant could not be created");
  }
}
