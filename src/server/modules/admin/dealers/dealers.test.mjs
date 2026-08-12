import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

test("admin dealer repository is PostgreSQL-only", () => {
  const source = readFileSync(new URL("./dealers.repository.ts", import.meta.url), "utf8");
  assert.equal(source.includes("php"), false);
  assert.equal(source.includes("mongodb"), false);
  assert.equal(source.includes("getDb"), false);
});
test("admin dealer repository can scope dealer lists to one assigned staff member", () => {
  const source = readFileSync(new URL("./dealers.repository.ts", import.meta.url), "utf8");
  assert.match(source, /staffAssignments:\s*\{\s*some:\s*\{\s*staffId:\s*BigInt\(input\.staffId\),\s*active:\s*true/);
  assert.match(source, /filters\.length === 1 \? base : \{ AND: filters \}/);
});
