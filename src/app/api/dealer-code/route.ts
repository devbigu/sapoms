import { NextRequest, NextResponse } from "next/server";

import { generatePostgresDealerCode } from "@/server/modules/dealers/dealer-code.service";
import { requireRole } from "@/server/auth/session";

export const runtime = "nodejs";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function json(body: Record<string, unknown>, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...NO_STORE_HEADERS,
      ...(init?.headers ?? {}),
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    await requireRole(["ADMIN", "STAFF"]);

    const dealerCode = await generatePostgresDealerCode(request.nextUrl.searchParams.get("candidate"));
    if (!dealerCode) {
      return json(
        { success: false, message: "All 4-digit dealer codes are already in use" },
        { status: 409 },
      );
    }

    return json({ success: true, dealerCode });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthenticated") {
      return json({ success: false, message: "Unauthenticated" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return json({ success: false, message: "Forbidden" }, { status: 403 });
    }
    console.error("[GET /api/dealer-code]", error);
    return json(
      { success: false, message: "Unable to generate a unique dealer code" },
      { status: 500 },
    );
  }
}
