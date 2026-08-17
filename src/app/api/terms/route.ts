import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { requireRole, writeAuthAuditLog } from "@/server/auth/session";
import { compatibilityFailure, compatibilitySuccess } from "@/server/http/compat-response";

export async function GET() {
  try {
    const actor = await requireRole("DEALER");
    const profile = await prisma.dealerProfile.findUnique({
      where: { id: actor.dealerId! },
      select: { termsAcceptedAt: true },
    });

    return NextResponse.json(
      compatibilitySuccess({
        accepted: Boolean(profile?.termsAcceptedAt),
        acceptedAt: profile?.termsAcceptedAt?.toISOString() ?? null,
      }),
    );
  } catch {
    return NextResponse.json(compatibilityFailure("Unauthenticated"), { status: 401 });
  }
}

export async function POST() {
  try {
    const actor = await requireRole("DEALER");
    const acceptedAt = new Date();

    await prisma.dealerProfile.update({
      where: { id: actor.dealerId! },
      data: { termsAcceptedAt: acceptedAt },
    });

    await writeAuthAuditLog({
      sessionId: actor.sessionId,
      userId: actor.userId,
      role: actor.role,
      eventType: "TERMS_ACCEPTED",
      metadata: {
        dealerId: actor.dealerId?.toString(),
        acceptedAt: acceptedAt.toISOString(),
      },
    });

    return NextResponse.json(
      compatibilitySuccess({
        accepted: true,
        acceptedAt: acceptedAt.toISOString(),
      }),
    );
  } catch {
    return NextResponse.json(compatibilityFailure("Unauthenticated"), { status: 401 });
  }
}
