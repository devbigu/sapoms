import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { compatibilityFailure, compatibilitySuccess } from "@/server/http/compat-response";
import { postgresAuthenticationProvider, normalizeEmail } from "@/server/auth/providers/postgres-auth.provider";
import { createSessionForUser, setAuthCookies, writeAuthAuditLog } from "@/server/auth/session";

const loginSchema = z.object({
  email: z.string().trim().min(1),
  password: z.string().min(1),
  roletype: z.enum(["1", "2", "3", "4"]).optional(),
});

async function readLoginInput(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    return {
      email: formData.get("email"),
      password: formData.get("password"),
      roletype: formData.get("roletype") || undefined,
    };
  }
  return request.json();
}

function failed(message = "Invalid credentials", status = 401) {
  return NextResponse.json(compatibilityFailure(message), { status });
}

function isDatabaseUnavailableError(error: unknown) {
  if (!(error instanceof Error)) return false;

  return (
    error.name === "PrismaClientInitializationError" ||
    error.message.includes("Can't reach database server") ||
    error.message.includes("Timed out fetching a new connection")
  );
}

export async function POST(request: NextRequest) {
  let requestedEmail: string | undefined;
  let requestedRole: string | undefined;

  try {
    const parsed = loginSchema.safeParse(await readLoginInput(request));
    if (!parsed.success) return failed("Invalid login request", 400);

    requestedEmail = normalizeEmail(parsed.data.email);
    requestedRole = parsed.data.roletype;

    const actor = await postgresAuthenticationProvider.authenticate({
      email: parsed.data.email,
      password: parsed.data.password,
      roleType: parsed.data.roletype,
    });

    const { accessToken, refreshToken } = await createSessionForUser(actor, request);
    const response = NextResponse.json(compatibilitySuccess(actor.profile));
    setAuthCookies(response, accessToken, refreshToken);
    return response;
  } catch (error) {
    console.error("[POST /api/auth/login]", error);
    await writeAuthAuditLog({
      eventType: "LOGIN_FAILED",
      request,
      metadata: {
        normalizedEmail: requestedEmail,
        requestedRole,
      },
    });
    if (isDatabaseUnavailableError(error)) {
      return failed("Authentication database is currently unavailable", 503);
    }
    return failed();
  }
}