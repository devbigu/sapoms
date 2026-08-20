import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { compatibilitySuccess } from "@/server/http/compat-response";
import { findActivePostgresUserByEmail, normalizeEmail } from "@/server/auth/providers/postgres-auth.provider";
import { createEmailOtpForUser, invalidateEmailOtp, isEmailOtpEnabled } from "@/server/auth/email-otp";
import { sendLoginOtp } from "@/server/auth/email";
import { writeAuthAuditLog } from "@/server/auth/session";

const requestSchema = z.object({
  email: z.string().email(),
});

const genericMessage = "If an active account exists for this email, a verification code has been sent.";

export async function POST(request: NextRequest) {
  if (!isEmailOtpEnabled()) return NextResponse.json({ message: "Not found" }, { status: 404 });

  let normalizedEmail: string | undefined;

  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json(compatibilitySuccess({}, genericMessage));

    normalizedEmail = normalizeEmail(parsed.data.email);

    let actor;
    try {
      actor = await findActivePostgresUserByEmail(normalizedEmail);
    } catch {
      await writeAuthAuditLog({
        eventType: "EMAIL_OTP_REQUEST_IGNORED",
        request,
        metadata: { normalizedEmail },
      });
      return NextResponse.json(compatibilitySuccess({}, genericMessage));
    }

    const { otp, record } = await createEmailOtpForUser(actor.userId);
    try {
      await sendLoginOtp(actor.email, otp);
    } catch (error) {
      await invalidateEmailOtp(record.id);
      await writeAuthAuditLog({
        userId: actor.userId,
        role: actor.role,
        eventType: "EMAIL_OTP_SEND_FAILED",
        request,
        metadata: { normalizedEmail },
      });
      throw error;
    }

    await writeAuthAuditLog({
      userId: actor.userId,
      role: actor.role,
      eventType: "EMAIL_OTP_REQUESTED",
      request,
      metadata: { normalizedEmail },
    });

    return NextResponse.json(compatibilitySuccess({}, genericMessage));
  } catch (error) {
    const status = Number((error as { status?: unknown }).status) || 500;
    await writeAuthAuditLog({
      eventType: "EMAIL_OTP_REQUEST_FAILED",
      request,
      metadata: { normalizedEmail, status },
    });
    return NextResponse.json(compatibilitySuccess({}, genericMessage), { status: status === 429 ? 200 : 500 });
  }
}