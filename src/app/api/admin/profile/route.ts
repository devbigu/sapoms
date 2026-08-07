import { NextRequest, NextResponse } from "next/server";
import { adminDetailResponse, adminMutationResponse } from "@/server/admin/admin-response";
import { adminErrorResponse } from "@/server/admin/admin-errors";
import { auditAdminAction, requireAdmin, requestIdFrom } from "@/server/admin/admin-route";
import { getAdminProfile, updateAdminProfile } from "@/server/modules/admin/profile/profile.service";
import { parseAdminProfileUpdate } from "@/server/modules/admin/profile/profile.schemas";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAdmin();
    const requestId = requestIdFrom(request);
    const data = await getAdminProfile(actor);
    await auditAdminAction({ actor, request, eventType: "ADMIN_PROFILE_VIEWED", route: "/api/admin/profile", requestId });
    return NextResponse.json(adminDetailResponse(data), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[GET /api/admin/profile]", error);
    return adminErrorResponse(error, "Admin profile is unavailable");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const actor = await requireAdmin();
    const requestId = requestIdFrom(request);
    const input = parseAdminProfileUpdate(await request.json());
    const data = await updateAdminProfile(actor, input, { requestId });
    return NextResponse.json(adminMutationResponse("Admin profile updated", data), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[PATCH /api/admin/profile]", error);
    return adminErrorResponse(error, "Admin profile could not be updated");
  }
}