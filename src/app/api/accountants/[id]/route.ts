import { NextRequest, NextResponse } from "next/server";
import { adminDetailResponse, adminMutationResponse } from "@/server/admin/admin-response";
import { adminErrorResponse } from "@/server/admin/admin-errors";
import { parseBigIntRouteParam, requireAdmin } from "@/server/admin/admin-route";
import { parseUpdateAdminAccountantInput } from "@/server/modules/admin/accountants/accountants.schemas";
import { deactivateAdminAccountant, getAdminAccountant, updateAdminAccountant } from "@/server/modules/admin/accountants/accountants.service";

export const runtime = "nodejs";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const data = await getAdminAccountant(parseBigIntRouteParam(id, "id"));
    return NextResponse.json(adminDetailResponse(data), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[GET /api/accountants/[id]]", error);
    return adminErrorResponse(error, "Accountant is unavailable");
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const input = await parseUpdateAdminAccountantInput(request);
    const data = await updateAdminAccountant(parseBigIntRouteParam(id, "id"), input);
    return NextResponse.json(adminMutationResponse("Accountant updated", data), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[PUT /api/accountants/[id]]", error);
    return adminErrorResponse(error, "Accountant could not be updated");
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const data = await deactivateAdminAccountant(parseBigIntRouteParam(id, "id"));
    return NextResponse.json(adminMutationResponse("Accountant deactivated", data), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[DELETE /api/accountants/[id]]", error);
    return adminErrorResponse(error, "Accountant could not be deactivated");
  }
}
