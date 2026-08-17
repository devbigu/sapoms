import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

async function read(file) {
  return fs.readFile(file, "utf8");
}

test("dealer terms acceptance is persisted in the dealer profile schema", async () => {
  const schema = await read("prisma/schema.prisma");
  assert.match(schema, /termsAcceptedAt\s+DateTime\?/);
  assert.match(schema, /terms_accepted_at/);
});

test("terms api is dealer-session authorized and updates acceptance time", async () => {
  const route = await read("src/app/api/terms/route.ts");
  assert.match(route, /requireRole\("DEALER"\)/);
  assert.match(route, /prisma\.dealerProfile\.update/);
  assert.match(route, /eventType: "TERMS_ACCEPTED"/);
});

test("root layout mounts the dealer terms gate globally", async () => {
  const layout = await read("src/app/layout.tsx");
  assert.match(layout, /DealerTermsGate/);
  assert.match(layout, /<DealerTermsGate \/>/);
});
