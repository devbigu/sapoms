import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

test("admin accountant repository is MongoDB-free", () => {
  const source = readFileSync(new URL("./accountants.repository.ts", import.meta.url), "utf8");
  assert.equal(source.includes("mongodb"), false);
  assert.equal(source.includes("getDb"), false);
});