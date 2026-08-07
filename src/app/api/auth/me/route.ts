import { NextRequest, NextResponse } from "next/server";
import { compatibilityFailure } from "@/server/http/compat-response";
import { ACCESS_COOKIE, currentProfileForAccessToken } from "@/server/auth/session";

export async function GET(request: NextRequest) {
  try {
    const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
    if (!accessToken) return NextResponse.json(compatibilityFailure("Unauthenticated"), { status: 401 });

    const profile = await currentProfileForAccessToken(accessToken);
    return NextResponse.json({
      status: true,
      success: true,
      data: profile,
    });
  } catch {
    return NextResponse.json(compatibilityFailure("Unauthenticated"), { status: 401 });
  }
}