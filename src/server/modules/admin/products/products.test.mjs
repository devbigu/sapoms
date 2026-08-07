import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

test("admin product mapper serializes price BigInts explicitly", () => {
  const source = readFileSync(new URL("./products.mapper.ts", import.meta.url), "utf8");
  assert.match(source, /unitPricePaise\.toString\(\)/);
  assert.match(source, /packPricePaise\.toString\(\)/);
});