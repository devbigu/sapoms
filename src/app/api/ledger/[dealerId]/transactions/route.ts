import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/session";
import { serializePrismaValue } from "@/server/db/prisma-serialize";
import { getDealerLedgerTransactions } from "@/lib/ledgerSystem";

export const runtime = "nodejs";

function positiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.floor(parsed);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ dealerId: string }> }) {
  try {
    const actor = await requireAuth();
    const { dealerId } = await params;
    const result = await getDealerLedgerTransactions(actor, dealerId, {
      page: positiveInt(req.nextUrl.searchParams.get("page"), 1),
      limit: positiveInt(req.nextUrl.searchParams.get("limit"), 20),
    });
    return NextResponse.json(
      serializePrismaValue({ success: true, ...result, isLive: true, paymentsLive: true, updatedAt: new Date().toISOString() }),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: any) {
    console.error("[GET /api/ledger/[dealerId]/transactions]", error);
    const status = Number(error?.status) || (error?.message === "Unauthenticated" ? 401 : 500);
    return NextResponse.json({ success: false, message: status >= 500 ? "Unable to load ledger transactions." : error.message }, { status });
  }
}
