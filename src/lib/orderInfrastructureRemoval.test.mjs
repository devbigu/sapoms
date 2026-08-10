import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import path from "node:path";

test("runtime order consumers use current order headers without persistent snapshot infrastructure", async () => {
  const files = [
    "src/app/api/orders-data/route.ts",
    "src/app/api/pending-products/route.ts",
    "src/app/api/reports/dealer-category/route.ts",
  ];
  const sources = await Promise.all(files.map((file) => fs.readFile(path.resolve(file), "utf8")));
  assert.match(sources[1], /prisma\.order\.findMany/);
  assert.match(sources[1], /dispatches/);
  assert.match(sources[2], /buildDealerCategoryReport/);
  assert.doesNotMatch(sources.join("\n"), /active_order_headers|active_order_snapshots|snapshot_locks/);
});

test("cutoff-era runtime files and routes are removed", async () => {
  const fragments = [
    ["src/lib/", "active", "OrderSnapshot.ts"],
    ["src/lib/", "active", "OrderAccess.ts"],
    ["src/app/api/", "active-orders", "/route.ts"],
    ["src/app/api/", "active-order", "/[id]/route.ts"],
  ];
  for (const fragmentsForPath of fragments) {
    const file = path.resolve(fragmentsForPath.join(""));
    await assert.rejects(fs.access(file));
  }
});

