import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const pendingRoute = await readFile(new URL("../app/api/pending-products/route.ts", import.meta.url), "utf8");
const dispatchRoute = await readFile(new URL("../app/api/order-dispatch/route.ts", import.meta.url), "utf8");
const pgDispatch = await readFile(new URL("./postgresOrderDispatch.ts", import.meta.url), "utf8");
const schema = await readFile(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");

const forbiddenRuntime = /orderdatalist|orderhispegination|orderpegination|staffOrderrPagination|staffDealers|getDb|MongoClient|order_dispatch_records|php-compat|mirisoft|dealerapi/;

test("pending-products is PostgreSQL-only and keeps pending aggregation helpers", () => {
  assert.match(pendingRoute, /prisma\.order\.findMany/);
  assert.match(pendingRoute, /Dealer_Id/);
  assert.match(pendingRoute, /Dealer_Name/);
  assert.match(pendingRoute, /mapPostgresOrderDispatchRecords/);
  assert.match(pendingRoute, /buildPendingProductLines/);
  assert.doesNotMatch(pendingRoute, forbiddenRuntime);
});

test("order-dispatch is PostgreSQL-only for reads and writes", () => {
  assert.match(dispatchRoute, /findPostgresOrderDispatchPayload\(lookup, actor\)/);
  assert.match(dispatchRoute, /applyPostgresOrderDispatch\(body\.orderId, actor, body\)/);
  assert.match(dispatchRoute, /requireAuth\(\)/);
  assert.match(dispatchRoute, /invalidatePendingProductsCache\(\)/);
  assert.doesNotMatch(dispatchRoute, forbiddenRuntime);
});

test("PostgreSQL dispatch model and transactional quantity protections exist", () => {
  assert.match(schema, /model OrderItemDispatch/);
  assert.match(schema, /dispatches\s+OrderItemDispatch\[\]/);
  assert.match(pgDispatch, /alreadyDispatched \+ quantity > item\.quantityPacks/);
  assert.match(pgDispatch, /prisma\.\$transaction/);
  assert.match(pgDispatch, /dispatchedAt: nextFulfilment === "DISPATCHED"/);
  assert.match(pgDispatch, /actor\.role === "DEALER"/);
  assert.match(pgDispatch, /order\.assignedStaffId === actor\.staffId/);
});