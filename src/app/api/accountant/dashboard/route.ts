import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/session";
import { assertGlobalReportActor, buildAccountantDashboard } from "@/server/reports/postgresReports";

export const runtime = "nodejs";

export async function GET() {
  try {
    const actor = await requireAuth();
    assertGlobalReportActor(actor);
    return NextResponse.json(await buildAccountantDashboard());
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "Forbidden" ? 403 : message === "Unauthenticated" ? 401 : 500;
    console.error("[GET /api/accountant/dashboard]", error);
    return NextResponse.json(
      { success: false, message: status === 403 ? "Reports are not available for this role." : "Unable to load accountant dashboard." },
      { status }
    );
  }
}
