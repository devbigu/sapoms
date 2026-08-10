import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

function read(path) {
  return readFileSync(path, "utf8");
}

test("accountant management repository is PostgreSQL User plus AccountantProfile", () => {
  const source = read("src/server/modules/admin/accountants/accountants.repository.ts");
  assert.match(source, /prisma\.user\.create/);
  assert.match(source, /role: "ACCOUNTANT"/);
  assert.match(source, /accountantProfile: \{/);
  assert.match(source, /prisma\.accountantProfile\.findMany/);
  assert.doesNotMatch(source, /mongodb|getDb|collection\("accountants"\)/);
});

test("admin accountant routes cover list create update and deactivate behind admin auth", () => {
  const listRoute = read("src/app/api/admin/accountants/route.ts");
  const detailRoute = read("src/app/api/admin/accountants/[accountantId]/route.ts");
  assert.match(listRoute, /export async function GET/);
  assert.match(listRoute, /export async function POST/);
  assert.match(detailRoute, /export async function PUT/);
  assert.match(detailRoute, /export async function DELETE/);
  assert.match(listRoute, /requireAdmin\(\)/);
  assert.match(detailRoute, /requireAdmin\(\)/);
  assert.match(detailRoute, /deactivateAdminAccountant/);
});

test("legacy accountant compatibility routes are PostgreSQL backed and controlled", () => {
  const listRoute = read("src/app/api/accountants/route.ts");
  const detailRoute = read("src/app/api/accountants/[id]/route.ts");
  assert.match(listRoute, /requireAdmin\(\)/);
  assert.match(detailRoute, /requireAdmin\(\)/);
  assert.match(listRoute, /listAdminAccountants|createAdminAccountant/);
  assert.match(detailRoute, /getAdminAccountant|updateAdminAccountant|deactivateAdminAccountant/);
  assert.doesNotMatch(listRoute + detailRoute, /mongodb|getDb|ObjectId|collection\("accountants"\)/);
});

test("legacy PHP and Mongo authentication routing providers are removed", () => {
  assert.equal(existsSync("src/server/auth/providers/mongo-accountant-auth.provider.ts"), false);
  assert.equal(existsSync("src/server/auth/providers/php-auth.provider.ts"), false);
  assert.equal(existsSync("src/server/auth/providers/auth-provider-router.ts"), false);
  const loginRoute = read("src/app/api/auth/login/route.ts");
  assert.match(loginRoute, /postgresAuthenticationProvider\.authenticate/);
  assert.doesNotMatch(loginRoute, /getAuthenticationProvider|phpAuthenticationProvider|login_verify/);
});

test("accountant identity and inactive rejection stay on PostgreSQL session auth", () => {
  const loginRoute = read("src/app/api/auth/login/route.ts");
  const meRoute = read("src/app/api/auth/me/route.ts");
  const provider = read("src/server/auth/providers/postgres-auth.provider.ts");
  const mapper = read("src/server/auth/legacy-auth.mapper.ts");
  assert.match(loginRoute, /postgresAuthenticationProvider\.authenticate/);
  assert.match(meRoute, /currentProfileForAccessToken/);
  assert.match(provider, /user\.status !== "ACTIVE"/);
  assert.match(provider, /user\.role !== expectedRole/);
  assert.match(mapper, /mapAccountantProfile/);
  assert.match(mapper, /accountantProfile/);
});

test("frontend accountant management calls PostgreSQL native admin routes", () => {
  const page = read("src/app/dashboard/admin/manageAccountants/add-account/page.tsx");
  const helper = read("src/lib/accountantauth.ts");
  assert.match(page, /\/admin\/accountants/);
  assert.match(helper, /\/admin\/accountants/);
  assert.doesNotMatch(page + helper, /\/api\$\{path\}.*\/accountants/);
});
