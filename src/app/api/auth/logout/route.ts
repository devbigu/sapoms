import { NextRequest, NextResponse } from "next/server";
import { compatibilitySuccess } from "@/server/http/compat-response";
import { ACCESS_COOKIE, clearAuthCookies, revokeSession, verifyAccessToken } from "@/server/auth/session";

export async function POST(request: NextRequest) {
  const response = NextResponse.json(compatibilitySuccess({}, "Logged out successfully"));
  try {
    const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
    if (accessToken) {
      const claims = verifyAccessToken(accessToken);
      await revokeSession(claims.sid, request);
    }
  } catch (error) {
    console.error("[POST /api/auth/logout]", error);
  }
  clearAuthCookies(response);
  return response;
}