import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/session";
import { buildDealerSelection, reportActorFromAuth, reportPagination } from "@/server/reports/postgresReports";

export const runtime = "nodejs";

const PAGE_SIZE = 10;

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

    const page = reportPagination.parsePositiveInt(req.nextUrl.searchParams.get("page"), 1, 100_000);
    const search = safeText(req.nextUrl.searchParams.get("search"), 240);
    const result = await buildDealerSelection({ actor, page, search, pageSize: PAGE_SIZE });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "Unauthenticated" ? 401 : message === "Forbidden" ? 403 : 500;
    console.error("[GET /api/reports/dealer-category/dealers]", error);
    return NextResponse.json(
      { success: false, message: status === 500 ? "Dealer search is unavailable right now." : "Reports are not available for this session." },
      { status }
    );
  }
}

