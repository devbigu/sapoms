import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const orderPaginationStub = `data:text/javascript;base64,${Buffer.from("export async function scanScopedOrders(){ throw new Error('not used'); }").toString("base64")}`;
const phpJsonStub = `data:text/javascript;base64,${Buffer.from("export async function parsePhpJsonResponse(response){ return response.json(); }").toString("base64")}`;
const source = (await fs.readFile(path.resolve("src/lib/orderHeaders.ts"), "utf8"))
  .replace(/from\s+["']@\/lib\/orderPagination["']/g, `from "${orderPaginationStub}"`)
  .replace(/from\s+["']@\/lib\/phpJson["']/g, `from "${phpJsonStub}"`);
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const orderHeaders = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);

test("pending order header source falls back to role-appropriate live endpoints", () => {
  assert.equal(orderHeaders.resolveOrderHeaderSource({ source: "orderpeginationnew", actor: { role: "admin", actorId: "" } }), "orderpegination");
  assert.equal(orderHeaders.resolveOrderHeaderSource({ source: "orderpeginationnew", actor: { role: "accountant", actorId: "" } }), "orderpegination");
  assert.equal(orderHeaders.resolveOrderHeaderSource({ source: "orderpeginationnew", actor: { role: "staff", actorId: "24" } }), "staffOrderrPagination");
  assert.equal(orderHeaders.resolveOrderHeaderSource({ source: "orderpeginationnew", actor: { role: "dealer", actorId: "225" } }), "orderhispegination");
  assert.equal(orderHeaders.resolveOrderHeaderSource({ source: "orderpegination", actor: { role: "admin", actorId: "" } }), "orderpegination");
});

test("pending source semantics accept numeric and text pending statuses only", () => {
  assert.equal(orderHeaders.isPendingOrderHeader({ order_status: "0" }), true);
  assert.equal(orderHeaders.isPendingOrderHeader({ status: "pending" }), true);
  assert.equal(orderHeaders.isPendingOrderHeader({ order_status: "Pending" }), true);
  assert.equal(orderHeaders.isPendingOrderHeader({ order_status: "1" }), false);
  assert.equal(orderHeaders.isPendingOrderHeader({ status: "completed" }), false);
});
