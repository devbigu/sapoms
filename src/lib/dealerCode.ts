export const MIN_DEALER_CODE = 1000;
export const MAX_DEALER_CODE = 9999;

export function normalizeDealerCode(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

export function isFourDigitDealerCode(value: unknown) {
  return /^\d{4}$/.test(normalizeDealerCode(value));
}

export function collectDealerCodes(rows: unknown[]) {
  return new Set(
    rows
      .map((row) => {
        const source = row && typeof row === "object" ? row as Record<string, unknown> : {};
        const snapshot = source.formSnapshot && typeof source.formSnapshot === "object"
          ? source.formSnapshot as Record<string, unknown>
          : {};

        return normalizeDealerCode(source.Dealer_Dealercode ?? source.dealerCode ?? snapshot.dealerCode);
      })
      .filter(Boolean),
  );
}

export function generateUniqueFourDigitDealerCode(
  existingCodes: Iterable<unknown>,
  random = Math.random,
) {
  const existing = new Set(Array.from(existingCodes, normalizeDealerCode).filter(Boolean));
  const range = MAX_DEALER_CODE - MIN_DEALER_CODE + 1;

  if (existing.size >= range) return "";

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const code = String(MIN_DEALER_CODE + Math.floor(random() * range));
    if (!existing.has(code)) return code;
  }

  for (let code = MIN_DEALER_CODE; code <= MAX_DEALER_CODE; code += 1) {
    const candidate = String(code);
    if (!existing.has(candidate)) return candidate;
  }

  return "";
}
