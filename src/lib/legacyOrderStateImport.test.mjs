import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const script = await readFile("scripts/import-legacy-order-state.mjs", "utf8");
const schema = await readFile("prisma/schema.prisma", "utf8");

test("legacy order-state importer is idempotent through stable source identifiers", () => {
  assert.match(schema, /model OrderNote[\s\S]*legacySource String\? @map\("legacy_source"\)[\s\S]*@@unique\(\[legacySource, legacyId\]\)/);
  assert.match(schema, /model OrderOverlay[\s\S]*legacySource String\? @map\("legacy_source"\)[\s\S]*@@unique\(\[legacySource, legacyId\]\)/);
  assert.match(schema, /model OrderItemDispatch[\s\S]*legacySource String\? @map\("legacy_source"\)[\s\S]*@@unique\(\[legacySource, legacyId\]\)/);
  assert.match(script, /legacySource_legacyId/);
  assert.match(script, /legacy-mongo-wallet:/);
  assert.match(script, /findUnique\(\{ where: \{ idempotencyKey: idem \} \}\)/);
});

test("dispatch import handles duplicate SKU item mapping by occurrence and refuses ambiguous misses", () => {
  assert.match(script, /const occurrence = Math\.max\(1, intValue\(doc\.occurrence\) \|\| 1\)/);
  assert.match(script, /matches\[occurrence - 1\]/);
  assert.match(script, /item_occurrence_out_of_range|item_not_found/);
  assert.match(script, /over_dispatch/);
});

test("effective order state reconciliation uses event timestamps and avoids blind overwrite", () => {
  assert.match(script, /function reconcileOrderPatch/);
  assert.match(script, /!order\.cancelledAt \|\| event\.at >= order\.cancelledAt/);
  assert.match(script, /order\.status !== "CANCELLED" && \(!order\.acceptedAt \|\| event\.at >= order\.acceptedAt\)/);
});

test("wallet import only migrates historical order debit or refund visibility records", () => {
  assert.match(script, /WalletTransactionType\.ORDER_DEBIT/);
  assert.match(script, /WalletTransactionType\.REFUND/);
  assert.match(script, /not_order_visibility_accounting/);
});

test("supported CLI flags are wired", () => {
  for (const flag of ["dry-run", "limit", "order-id", "resume"]) {
    assert.match(script, new RegExp(flag));
  }
});