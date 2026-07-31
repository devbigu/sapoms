import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const orderAmountsUrl = pathToFileURL(path.resolve("src/lib/orderAmounts.ts")).href;
const source = (await fs.readFile(path.resolve("src/lib/companySales.ts"), "utf8"))
  .replace(/from\s+["']@\/lib\/orderAmounts["']/g, `from "${orderAmountsUrl}"`);
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const companySales = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);

test("groupOrdersByDistributor carries base and slab discount separately while preserving total discount", () => {
  const orders = [
    {
      order_id: "1",
      order_dealer: "D1",
      Dealer_Name: "Dealer A",
      order_amount: 100,
    },
    {
      order_id: "2",
      order_dealer: "D1",
      Dealer_Name: "Dealer A",
      order_amount: 200,
    },
  ];

  const overrides = {
    1: {
      grossAmount: 100,
      discountAmount: 60,
      netPayableAmount: 40,
      baseDiscountAmount: 50,
      additionalDiscountType: "slab",
      slabDiscountAmount: 10,
      slabDiscountPercent: 2,
    },
  };

  const rows = companySales.groupOrdersByDistributor(orders, overrides);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].grossSales, 300);
  assert.equal(rows[0].baseDiscount, 50);
  assert.equal(rows[0].slabDiscount, 10);
  assert.equal(rows[0].discount, 60);
  assert.equal(rows[0].netSales, 240);
});
