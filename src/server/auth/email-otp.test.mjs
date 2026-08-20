import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";

async function read(file) {
  return fs.readFile(file, "utf8");
}

test("Email OTP is disabled by server and public feature flags", async () => {
  const requestRoute = await read("src/app/api/auth/email-otp/request/route.ts");
  const verifyRoute = await read("src/app/api/auth/email-otp/verify/route.ts");
  const loginPage = await read("src/app/auth/login/page.tsx");
  const env = await read(".env");

  assert.match(env, /ENABLE_EMAIL_OTP=false/);
  assert.match(env, /NEXT_PUBLIC_ENABLE_EMAIL_OTP=false/);
  assert.match(requestRoute, /if \(!isEmailOtpEnabled\(\)\) return NextResponse\.json\(\{ message: "Not found" \}, \{ status: 404 \}\)/);
  assert.match(verifyRoute, /if \(!isEmailOtpEnabled\(\)\) return NextResponse\.json\(\{ message: "Not found" \}, \{ status: 404 \}\)/);
  assert.match(loginPage, /process\.env\.NEXT_PUBLIC_ENABLE_EMAIL_OTP === "true"/);
});

test("Email OTP storage is hashed, single-use, attempt-limited, and user-scoped", async () => {
  const helper = await read("src/server/auth/email-otp.ts");
  const schema = await read("prisma/schema.prisma");
  const emailOtpModel = schema.match(/model EmailOtp \{[\s\S]*?\n\}/)?.[0] ?? "";
  const migration = await read("prisma/migrations/20260820120000_email_otp_user_relation/migration.sql");

  assert.match(emailOtpModel, /model EmailOtp/);
  assert.match(emailOtpModel, /userId\s+BigInt\s+@map\("user_id"\)/);
  assert.match(emailOtpModel, /codeHash\s+String\s+@map\("code_hash"\)/);
  assert.doesNotMatch(emailOtpModel, /plaintext|\n\s+code\s+String/);
  assert.match(migration, /FOREIGN KEY \("user_id"\) REFERENCES "users"\("id"\)/);
  assert.match(helper, /randomInt\(0, 1_000_000\)/);
  assert.match(helper, /AUTH_OTP_PEPPER/);
  assert.match(helper, /OTP_TTL_MS = 5 \* 60 \* 1000/);
  assert.match(helper, /OTP_MAX_ATTEMPTS = 5/);
  assert.match(helper, /OTP_RESEND_COOLDOWN_MS = 30 \* 1000/);
  assert.match(helper, /tx\.emailOtp\.updateMany/);
  assert.match(helper, /usedAt: now/);
  assert.match(helper, /timingSafeEqual/);
});

test("Email OTP routes reuse PostgreSQL user loading and the existing session cookies", async () => {
  const provider = await read("src/server/auth/providers/postgres-auth.provider.ts");
  const requestRoute = await read("src/app/api/auth/email-otp/request/route.ts");
  const verifyRoute = await read("src/app/api/auth/email-otp/verify/route.ts");
  const loginRoute = await read("src/app/api/auth/login/route.ts");

  assert.match(provider, /export async function findActivePostgresUserByEmail/);
  assert.match(provider, /mapPostgresUserToLegacyProfile/);
  assert.match(provider, /getProfileId/);
  assert.match(requestRoute, /findActivePostgresUserByEmail/);
  assert.match(requestRoute, /sendLoginOtp/);
  assert.doesNotMatch(requestRoute, /return NextResponse\.json\([^;]*otp/i);
  assert.match(verifyRoute, /createSessionForUser\(actor, request\)/);
  assert.match(verifyRoute, /setAuthCookies\(response, accessToken, refreshToken\)/);
  assert.match(verifyRoute, /compatibilitySuccess\(actor\.profile\)/);
  assert.match(loginRoute, /postgresAuthenticationProvider\.authenticate/);
});