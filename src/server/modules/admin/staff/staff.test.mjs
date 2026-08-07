import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

test("admin staff mapper does not expose password fields", () => {
  const source = readFileSync(new URL("./staff.mapper.ts", import.meta.url), "utf8");
  assert.equal(source.includes("password"), false);
});