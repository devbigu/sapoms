import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { compatibilityFailure, compatibilitySuccess } from "@/server/http/compat-response";
import { findActivePostgresUserByEmail, normalizeEmail } from "@/server/auth/providers/postgres-auth.provider";
import { isEmailOtpEnabled, verifyEmailOtpForUser } from "@/server/auth/email-otp";
import { createSessionForUser, setAuthCookies, writeAuthAuditLog } from "@/server/auth/session";

const verifySchema = z.object({
  email: z.string().email(),
  otp: z.string().trim().regex(/^\d{6}$/),
});

function failed(message = "Invalid verification code", status = 401) {
  return NextResponse.json(compatibilityFailure(message), { status });
}

export async function POST(request: NextRequest) {
  if (!isEmailOtpEnabled()) return NextResponse.json({ message: "Not found" }, { status: 404 });

  let normalizedEmail: string | undefined;

  try {
    const parsed = verifySchema.safeParse(await request.json());
    if (!parsed.success) return failed("Invalid verification request", 400);

    normalizedEmail = normalizeEmail(parsed.data.email);
    const actor = await findActivePostgresUserByEmail(normalizedEmail);

    await verifyEmailOtpForUser(actor.userId, parsed.data.otp);

    const { accessToken, refreshToken } = await createSessionForUser(actor, request);
    await writeAuthAuditLog({
      userId: actor.userId,
      role: actor.role,
      eventType: "EMAIL_OTP_LOGIN_SUCCEEDED",
      request,
      metadata: { normalizedEmail },
    });

    const response = NextResponse.json(compatibilitySuccess(actor.profile));
    setAuthCookies(response, accessToken, refreshToken);
    return response;
  } catch {
    await writeAuthAuditLog({
      eventType: "EMAIL_OTP_LOGIN_FAILED",
      request,
      metadata: { normalizedEmail },
    });
    return failed();
  }
}