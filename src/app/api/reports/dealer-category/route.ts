import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/session";
import { buildDealerCategoryReport, reportActorFromAuth } from "@/server/reports/postgresReports";

export const runtime = "nodejs";

function safeText(value: unknown, max = 240) {
  return String(value ?? "").trim().slice(0, max);
}

export async function GET(req: NextRequest) {
  try {
    const authActor = await requireAuth();
    const actor = reportActorFromAuth(authActor);
    if (!actor) {
      return NextResponse.json({ success: false, message: "Reports are not available for this session." }, { status: 403 });
    }

    const dealerId = safeText(req.nextUrl.searchParams.get("dealerId"), 120);
    const from = safeText(req.nextUrl.searchParams.get("from"), 20);
    const to = safeText(req.nextUrl.searchParams.get("to"), 20);
    const requestedStatus = safeText(req.nextUrl.searchParams.get("status"), 20).toLowerCase();
    const statusFilter = requestedStatus === "accepted" || requestedStatus === "completed" ? requestedStatus : "all";

    if (!dealerId) {
      return NextResponse.json({ success: false, message: "Dealer ID is required" }, { status: 400 });
    }

    const report = await buildDealerCategoryReport({ actor, dealerId, from, to, statusFilter });
    if (!report) {
      return NextResponse.json({ success: false, message: "Dealer not found or not available for this report." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      dealer: report.dealer,
      summary: report.summary,
      products: report.products,
      categories: report.categories,
      warnings: report.warnings,
      meta: {
        ...report.meta,
        dealerId,
        role: actor.scope,
        orderRouteBase: "/orders",
        statusFilter,
        includedOrderRule: "PostgreSQL orders excluding CANCELLED and DECLINED; accepted and completed filters narrow from that eligible set.",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "Unauthenticated" ? 401 : message === "Forbidden" ? 403 : 500;
    console.error("[GET /api/reports/dealer-category]", error);
    return NextResponse.json(
      { success: false, message: status === 500 ? "Unable to fetch this dealer's PostgreSQL report." : "Reports are not available for this session." },
      { status }
    );
  }
}

