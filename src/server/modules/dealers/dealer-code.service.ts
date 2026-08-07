import "server-only";

import { prisma } from "@/server/db/prisma";
import {
  RESERVED_DEALER_REQUEST_STATUSES,
  collectDealerCodes,
  generateNextFourDigitDealerCode,
  isFourDigitDealerCode,
  normalizeDealerCode,
} from "@/lib/dealerCode";

export async function loadPostgresDealerCodes() {
  const [dealerProfiles, dealerRequests] = await prisma.$transaction([
    prisma.dealerProfile.findMany({
      select: { dealerCode: true },
    }),
    prisma.dealerRequest.findMany({
      where: { status: { in: [...RESERVED_DEALER_REQUEST_STATUSES] } },
      select: { dealerCode: true, formSnapshot: true },
    }),
  ]);

  return {
    profileCodes: collectDealerCodes(dealerProfiles),
    reservedRequestCodes: collectDealerCodes(dealerRequests),
  };
}

export async function generatePostgresDealerCode(candidate?: unknown) {
  const { profileCodes, reservedRequestCodes } = await loadPostgresDealerCodes();
  const existingCodes = new Set([...profileCodes, ...reservedRequestCodes]);
  const normalizedCandidate = normalizeDealerCode(candidate);

  if (isFourDigitDealerCode(normalizedCandidate) && !existingCodes.has(normalizedCandidate)) {
    return normalizedCandidate;
  }

  return generateNextFourDigitDealerCode(existingCodes);
}

export async function findDealerCodeReservationConflict(
  dealerCode: unknown,
  options: { excludeRequestId?: bigint } = {},
) {
  const normalizedDealerCode = normalizeDealerCode(dealerCode);
  if (!isFourDigitDealerCode(normalizedDealerCode)) return null;

  const [dealerProfile, dealerRequest] = await prisma.$transaction([
    prisma.dealerProfile.findUnique({
      where: { dealerCode: normalizedDealerCode },
      select: { id: true },
    }),
    prisma.dealerRequest.findFirst({
      where: {
        dealerCode: normalizedDealerCode,
        status: { in: [...RESERVED_DEALER_REQUEST_STATUSES] },
        ...(options.excludeRequestId ? { id: { not: options.excludeRequestId } } : {}),
      },
      select: { id: true },
    }),
  ]);

  if (dealerProfile) return "dealer-profile";
  if (dealerRequest) return "dealer-request";
  return null;
}


