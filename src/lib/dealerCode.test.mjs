import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

async function transpileToDataUrl(filePath) {
  const source = await fs.readFile(filePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filePath,
  }).outputText;

  return `data:text/javascript;base64,${Buffer.from(transpiled, "utf8").toString("base64")}`;
}

const dealerCodeUrl = await transpileToDataUrl(path.resolve("src/lib/dealerCode.ts"));
const dealerCode = await import(dealerCodeUrl);

const routeSource = await fs.readFile(path.resolve("src/app/api/dealer-code/route.ts"), "utf8");
const serviceSource = await fs.readFile(path.resolve("src/server/modules/dealers/dealer-code.service.ts"), "utf8");
const schemaSource = await fs.readFile(path.resolve("prisma/schema.prisma"), "utf8");

test("empty PostgreSQL code sets return the first dealer code", () => {
  assert.equal(dealerCode.generateNextFourDigitDealerCode([]), "1000");
});

test("highest existing dealer code plus one is returned", () => {
  assert.equal(dealerCode.generateNextFourDigitDealerCode(["1000", "1001", "1042"]), "1043");
});

test("dealer profile and reserved request codes are normalized into one code set", () => {
  const profileCodes = dealerCode.collectDealerCodes([{ dealerCode: "1003" }, { dealerCode: " 1004 " }]);
  const requestCodes = dealerCode.collectDealerCodes([{ dealerCode: "1007" }, { formSnapshot: { dealerCode: "1008" } }]);
  assert.deepEqual([...new Set([...profileCodes, ...requestCodes])].sort(), ["1003", "1004", "1007", "1008"]);
});

test("gaps do not cause duplicate generation", () => {
  assert.equal(dealerCode.generateNextFourDigitDealerCode(["1000", "1002"]), "1003");
});

test("malformed codes are ignored safely", () => {
  assert.equal(dealerCode.generateNextFourDigitDealerCode(["DLR-9999", "abcd", "099", "1005"]), "1006");
});

test("existing prefix and zero padding contract is preserved as no-prefix four-digit codes", () => {
  assert.equal(dealerCode.MIN_DEALER_CODE, 1000);
  assert.equal(dealerCode.DEALER_CODE_WIDTH, 4);
  assert.equal(dealerCode.isFourDigitDealerCode("1000"), true);
  assert.equal(dealerCode.isFourDigitDealerCode("DLR-1000"), false);
});

test("route response shape and unauthorized handling remain compatible", () => {
  assert.match(routeSource, /return json\(\{ success: true, dealerCode \}\)/);
  assert.match(routeSource, /success: false, message: "All 4-digit dealer codes are already in use"/);
  assert.match(routeSource, /success: false, message: "Unable to generate a unique dealer code"/);
  assert.match(routeSource, /requireRole\(\["ADMIN", "STAFF"\]\)/);
  assert.match(routeSource, /message: "Unauthenticated"/);
  assert.match(routeSource, /status: 401/);
  assert.match(routeSource, /message: "Forbidden"/);
  assert.match(routeSource, /status: 403/);
});

test("route uses PostgreSQL DealerProfile and DealerRequest only", () => {
  assert.match(serviceSource, /prisma\.dealerProfile\.findMany/);
  assert.match(serviceSource, /prisma\.dealerRequest\.findMany/);
  assert.match(serviceSource, /status: \{ in: \[\.\.\.RESERVED_DEALER_REQUEST_STATUSES\] \}/);
  assert.match(serviceSource, /select: \{ dealerCode: true \}/);
  assert.match(serviceSource, /select: \{ dealerCode: true, formSnapshot: true \}/);
});

test("no MongoDB imports or calls remain in dealer-code route or service", () => {
  const combined = `${routeSource}\n${serviceSource}`;
  for (const forbidden of ["@/lib/mongodb", "getDb", "getDealerRequestCollection", "mongodb", "MongoDB"]) {
    assert.equal(combined.includes(forbidden), false, forbidden);
  }
});

test("no PHP imports, facade calls, or legacy dealer-list fetches remain in dealer-code route or service", () => {
  const combined = `${routeSource}\n${serviceSource}`;
  for (const forbidden of ["phpBackend", "getPhpApiBaseUrl", "BACKEND_URL", "dealerpegination", "fetchJson", "External dealer API", "php-client", "php-compat"]) {
    assert.equal(combined.includes(forbidden), false, forbidden);
  }
});

test("dealer profile dealer-code field has a unique constraint", () => {
  assert.match(schemaSource, /model DealerProfile[\s\S]*dealerCode\s+String\?\s+@unique\s+@map\("dealer_code"\)/);
});
