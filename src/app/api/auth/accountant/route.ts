import { NextResponse } from "next/server";
import { compatibilityFailure } from "@/server/http/compat-response";

export async function POST() {
  return NextResponse.json(compatibilityFailure("Accountant legacy login is retired"), { status: 410 });
}