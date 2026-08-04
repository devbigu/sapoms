import { NextRequest, NextResponse } from "next/server";

import {
  collectDealerCodes,
  generateUniqueFourDigitDealerCode,
  isFourDigitDealerCode,
  normalizeDealerCode,
} from "@/lib/dealerCode";
import { getDb } from "@/lib/mongodb";
import { getDealerRequestCollection } from "@/lib/dealerRequests";
import { getPhpApiBaseUrl } from "@/lib/phpBackend";

export const runtime = "nodejs";

const BACKEND_URL = getPhpApiBaseUrl();
const PAGE_SIZE = 100;
const MAX_PAGES = 200;

type DealerResponse = {
  data?: unknown[];
  total?: number;
  count?: number;
  last_page?: number;
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`External dealer API failed with ${response.status}`);
  }

  if (/^\s*</.test(text)) {
    throw new Error("External dealer API returned HTML instead of JSON");
  }

  return JSON.parse(text) as T;
}

async function fetchExistingDealerCodes() {
  const codes = new Set<string>();
  const firstPage = await fetchJson<DealerResponse>(
    `${BACKEND_URL}/dealerpegination?page=1&limit=${PAGE_SIZE}&search=`,
  );

  for (const code of collectDealerCodes(firstPage.data ?? [])) codes.add(code);

  const total = Number(firstPage.total ?? firstPage.count ?? codes.size) || codes.size;
  const detectedPageSize = Math.max(1, firstPage.data?.length || PAGE_SIZE);
  const lastPage = Math.min(
    MAX_PAGES,
    Math.max(1, Number(firstPage.last_page) || Math.ceil(total / detectedPageSize)),
  );

  for (let page = 2; page <= lastPage; page += 1) {
    const payload = await fetchJson<DealerResponse>(
      `${BACKEND_URL}/dealerpegination?page=${page}&limit=${PAGE_SIZE}&search=`,
    );
    const rows = payload.data ?? [];
    for (const code of collectDealerCodes(rows)) codes.add(code);
    if (rows.length === 0) break;
  }

  return codes;
}

async function fetchPendingRequestCodes() {
  try {
    const db = await getDb();
    const rows = await getDealerRequestCollection(db)
      .find(
        { status: "pending" },
        { projection: { dealerCode: 1, formSnapshot: 1 } },
      )
      .toArray();

    return collectDealerCodes(rows);
  } catch (error) {
    console.warn("[GET /api/dealer-code] pending request code lookup failed", error);
    return new Set<string>();
  }
}

export async function GET(request: NextRequest) {
  try {
    const candidate = normalizeDealerCode(request.nextUrl.searchParams.get("candidate"));
    const existingCodes = await fetchExistingDealerCodes();
    const pendingCodes = await fetchPendingRequestCodes();
    for (const code of pendingCodes) existingCodes.add(code);

    if (isFourDigitDealerCode(candidate) && !existingCodes.has(candidate)) {
      return NextResponse.json({ success: true, dealerCode: candidate });
    }

    const dealerCode = generateUniqueFourDigitDealerCode(existingCodes);
    if (!dealerCode) {
      return NextResponse.json(
        { success: false, message: "All 4-digit dealer codes are already in use" },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true, dealerCode });
  } catch (error) {
    console.error("[GET /api/dealer-code]", error);
    return NextResponse.json(
      { success: false, message: "Unable to generate a unique dealer code" },
      { status: 500 },
    );
  }
}
