import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/session";
import { serializePrismaValue } from "@/server/db/prisma-serialize";
import { recordLedgerPayment } from "@/lib/ledgerSystem";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ dealerId: string }> }) {
  try {
    const actor = await requireAuth();
    const { dealerId } = await params;
    const body = await req.json();
    const result = await recordLedgerPayment(actor, dealerId, body, req.headers.get("idempotency-key"));
    return NextResponse.json(
      serializePrismaValue({
        success: true,
        message: result.duplicate ? "Duplicate payment ignored" : "Payment recorded successfully",
        duplicate: Boolean(result.duplicate),
        transaction: result.transaction,
        transactionId: result.transaction?.id,
        bill: result.bill,
      }),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: any) {
    console.error("[POST /api/ledger/[dealerId]/pay]", error);
    const status = Number(error?.status) || (error?.message === "Unauthenticated" ? 401 : 500);
    return NextResponse.json({ success: false, message: status >= 500 ? "Unable to record payment." : error.message }, { status });
  }
}