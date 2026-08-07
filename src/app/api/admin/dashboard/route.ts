import { NextResponse } from "next/server";
import { getPostgresAdminDashboard } from "@/server/modules/admin-dashboard/postgres-admin-dashboard.repository";
import { requireAdmin } from "@/server/admin/admin-route";
import { adminErrorResponse } from "@/server/admin/admin-errors";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
    const data = await getPostgresAdminDashboard();

    return NextResponse.json(
      {
        status: true,
        success: true,
        data,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const response = adminErrorResponse(error, "Dashboard data is temporarily unavailable");
    if (response.status !== 500) return response;

    console.error("[GET /api/admin/dashboard]", error);
    return NextResponse.json(
      {
        status: false,
        success: false,
        msg: "Dashboard data is temporarily unavailable",
        message: "Dashboard data is temporarily unavailable",
        error: { code: "INTERNAL_ERROR" },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}