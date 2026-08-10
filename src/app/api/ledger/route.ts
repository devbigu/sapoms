import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/session";
import { serializePrismaValue } from "@/server/db/prisma-serialize";
import { getCollectiveLedger } from "@/lib/ledgerSystem";

export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  try {
    const actor = await requireAuth();
    const data = await getCollectiveLedger(actor);
    const now = new Date().toISOString();
    return NextResponse.json(
      serializePrismaValue({ success: true, data, total: data.length, isLive: true, updatedAt: now, paymentsLive: true }),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: any) {
    console.error("[GET /api/ledger]", error);
    const status = Number(error?.status) || (error?.message === "Unauthenticated" ? 401 : 500);
    return NextResponse.json({ success: false, message: status >= 500 ? "Unable to load ledger." : error.message }, { status });
  }
}
