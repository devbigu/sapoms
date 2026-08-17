import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const source = await readFile(new URL("./postgresOrderStatus.ts", import.meta.url), "utf8");
const overlayRoute = await readFile(new URL("../app/api/order-overlays/[id]/route.ts", import.meta.url), "utf8");
const dispatchRoute = await readFile(new URL("../app/api/order-dispatch/route.ts", import.meta.url), "utf8");
const postgresOrders = await readFile(new URL("./postgresOrders.ts", import.meta.url), "utf8");
const forbidden = /saveAcceptedState|saveCancellation|loadEffectiveContext|fetchPhpOrderPayload|getDb|MongoClient|php-compat|orderdatalist|orderhispegination|orderpegination|mirisoft|dealerapi/;

test("PostgreSQL order status service validates legal transitions and timestamps", () => {
  assert.match(source, /assertAcceptanceTransition/);
  assert.match(source, /current !== "AWAITING"/);
  assert.match(source, /next !== "ACCEPTED" && next !== "DECLINED"/);
  assert.match(source, /assertFulfilmentTransition/);
  assert.match(source, /nextIndex !== currentIndex \+ 1/);
  assert.match(source, /acceptedAt: next === "ACCEPTED" \? now/);
  assert.match(source, /cancelledAt: new Date\(\)/);
  assert.match(source, /cancellationReason: reasonText/);
  assert.match(source, /dispatchedAt: next === "DISPATCHED"/);
  assert.match(source, /completedAt: next === "COMPLETED"/);
});

test("dealer staff and admin permissions are enforced from JWT/profile identity", () => {
  assert.match(source, /actor\.role === "ADMIN"/);
  assert.match(source, /actor\.role === "NSM"/);
  assert.match(source, /permission === "read" \|\| permission === "acceptance" \|\| permission === "fulfilment"/);
  assert.match(source, /isStaffLike\(actor\)/);
  assert.match(source, /order\.dealerId !== actor\.dealerId/);
  assert.match(source, /Dealers cannot perform staff-only order transitions/);
  assert.match(source, /dealerStaffAssignment\.findFirst/);
  assert.match(source, /Staff, RSM, and ASM cannot cancel Dealer orders/);
  assert.match(source, /NSM cannot cancel Dealer orders/);
  assert.match(overlayRoute, /requireAuth\(\)/);
  assert.match(dispatchRoute, /requireAuth\(\)/);
});

test("legacy accept_order and del_status remain response aliases only for PostgreSQL status", () => {
  assert.match(source, /legacyAcceptOrderAlias/);
  assert.match(source, /legacyDelStatusAlias/);
  assert.match(source, /accept_order: legacyAcceptOrderAlias\(updated\.acceptanceStatus\)/);
  assert.match(source, /del_status: legacyDelStatusAlias\(updated\.status\)/);
  assert.match(postgresOrders, /accept_order: legacyAcceptance\(order\.acceptanceStatus\)/);
  assert.match(postgresOrders, /del_status: legacyDeletion\(order\.status\)/);
});

test("PostgreSQL order mutations bypass PHP and Mongo status writes", () => {
  assert.match(overlayRoute, /updatePostgresOrderAcceptance\(id, authActor, "ACCEPTED"\)/);
  assert.match(overlayRoute, /updatePostgresOrderFulfilment\(id, authActor, fulfilmentStatus\)/);
  assert.match(overlayRoute, /cancelPostgresOrder\(id, authActor, body\.reason\)/);
  assert.match(dispatchRoute, /applyPostgresOrderDispatch\(body\.orderId, actor, body\)/);
  assert.doesNotMatch(overlayRoute + dispatchRoute, forbidden);
});

 test("non-PostgreSQL status and dispatch mutations fail explicitly", () => {
  assert.match(overlayRoute, /Historical PHP orders are read-only for PostgreSQL status updates/);
  assert.match(overlayRoute, /Historical PHP orders are read-only for PostgreSQL cancellation/);
  assert.match(dispatchRoute, /Historical PHP orders are read-only for dispatch updates/);
});