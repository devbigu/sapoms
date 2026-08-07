import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

async function loadTsModule(file) {
  const source = await fs.readFile(path.resolve(file), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

const sanitizer = await loadTsModule("src/server/auth/sanitize-profile.ts");
const compat = await loadTsModule("src/server/http/compat-response.ts");
const providerTypes = await loadTsModule("src/server/auth/providers/types.ts");

test("legacy role map includes the unified accountant role", () => {
  assert.deepEqual(providerTypes.LEGACY_ROLE_MAP, {
    "1": "STAFF",
    "2": "DEALER",
    "3": "ADMIN",
    "4": "ACCOUNTANT",
  });
});

test("sanitizes sensitive legacy password fields", () => {
  assert.deepEqual(sanitizer.sanitizeLegacyProfile({
    Dealer_Id: "226",
    Dealer_Password: "dealer-secret",
    staff_password: "staff-secret",
    ADMIN_PASSWORD: "admin-secret",
    password: "plain-secret",
    passwordHash: "hash-secret",
    Dealer_Name: "Demo Dealer",
  }), {
    Dealer_Id: "226",
    Dealer_Name: "Demo Dealer",
  });
});

test("adds lowercase compatibility role without changing legacy field names", () => {
  assert.deepEqual(sanitizer.withClientRole({ Dealer_Id: "226", Dealer_Name: "Demo Dealer" }, "DEALER"), {
    Dealer_Id: "226",
    Dealer_Name: "Demo Dealer",
    role: "dealer",
  });
});

test("compatibility responses keep status and success aliases", () => {
  assert.deepEqual(compat.compatibilitySuccess({ id: "abc" }), {
    status: true,
    success: true,
    msg: "Login successful",
    message: "Login successful",
    data: { id: "abc" },
  });

  assert.deepEqual(compat.compatibilityFailure(), {
    status: false,
    success: false,
    msg: "Invalid credentials",
    message: "Invalid credentials",
  });
});

test("pagination serializer preserves alias fields", () => {
  assert.deepEqual(compat.withPaginationAliases({ data: [], total: 12, lastPage: 3 }), {
    status: true,
    success: true,
    data: [],
    total: 12,
    lastPage: 3,
    count: 12,
    recordsTotal: 12,
    recordsFiltered: 12,
    last_page: 3,
  });
});
