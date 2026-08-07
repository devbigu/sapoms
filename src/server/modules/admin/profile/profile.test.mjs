import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

test("admin profile mapper does not expose password fields", () => {
  const mapper = readFileSync(new URL("./profile.mapper.ts", import.meta.url), "utf8");
  assert.equal(mapper.includes("passwordHash"), false);
  assert.equal(mapper.includes("ADMIN_PASSWORD"), false);
});