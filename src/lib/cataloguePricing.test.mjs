import test from "node:test";
import assert from "node:assert/strict";
import pricing from "./cataloguePricing.js";

test("manual order keeps catalogue price as per-unit rupees", () => {
  assert.equal(pricing.variantPriceToUnitRupees(440), 440);
});

test("single-unit packs keep their catalogue price", () => {
  assert.equal(pricing.variantPriceToUnitRupees(125), 125);
});

test("per-unit values round consistently to paise without pack division", () => {
  assert.equal(pricing.variantPriceToUnitRupees(100.555), 100.56);
});

test("legacy helper name also keeps catalogue price as per-unit rupees", () => {
  assert.equal(pricing.variantPackPriceToUnitRupees(5200, 100), 5200);
});
