import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

test("admin dealer repository is PostgreSQL-only", () => {
  const source = readFileSync(new URL("./dealers.repository.ts", import.meta.url), "utf8");
  assert.equal(source.includes("php"), false);
  assert.equal(source.includes("mongodb"), false);
  assert.equal(source.includes("getDb"), false);
});