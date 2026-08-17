import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const types = readFileSync("src/server/modules/admin-dashboard/admin-dashboard.types.ts", "utf8");
const repo = readFileSync("src/server/modules/admin-dashboard/postgres-admin-dashboard.repository.ts", "utf8");
const page = readFileSync("src/app/dashboard/admin/page.tsx", "utf8");

test("admin dashboard exposes regional sales and top distributors by region", () => {
  assert.match(types, /SalesRegionKey/);
  assert.match(types, /regionalPerformance/);
  assert.match(types, /topDistributorsByRegion/);
  assert.match(repo, /dealer:\s*\{\s*select:\s*\{\s*region:\s*true/);
  assert.match(repo, /topDistributorsByRegion/);
  assert.match(repo, /TOP_REGION_DEALER_LIMIT = 5/);
  assert.match(page, /RSM Net Sales/);
  assert.match(page, /Top Distributors by Region/);
  assert.match(page, /selectedRegion/);
  assert.match(page, /LineChart/);
  assert.match(page, /SALES_REGIONS\.map/);
});
