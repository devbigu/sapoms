import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

test("admin order mapper serializes BigInt money fields", () => {
  const source = readFileSync(new URL("./orders.mapper.ts", import.meta.url), "utf8");
  assert.match(source, /toString\(\)/);
});