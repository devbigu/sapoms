import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (relative) => readFileSync(new URL(relative, import.meta.url), "utf8");
const repo = read("./dealers.repository.ts");
const mapper = read("./dealers.mapper.ts");
const schemas = read("./dealers.schemas.ts");

const rootRoute = read("../../../../app/api/admin/dealers/route.ts");
const detailRoute = read("../../../../app/api/admin/dealers/[dealerId]/route.ts");
const statusRoute = read("../../../../app/api/admin/dealers/[dealerId]/status/route.ts");
const staffRoute = read("../../../../app/api/admin/dealers/[dealerId]/staff/route.ts");

const dealerListPage = read("../../../../app/dashboard/admin/dealer/DealerList/page.tsx");
const addDealerPage = read("../../../../app/dashboard/admin/dealer/AddDealerForm/page.tsx");
const editDealerPage = read("../../../../app/dashboard/admin/dealer/[dealerId]/page.tsx");
const dealerFormCard = read("../../../../components/dealers/DealerFormCard.tsx");

test("admin dealer mutations are PostgreSQL-only", () => {
  for (const source of [repo, rootRoute, detailRoute, statusRoute, staffRoute]) {
    assert.equal(source.includes("php"), false);
    assert.equal(source.includes("mongodb"), false);
    assert.equal(source.includes("getDb"), false);
    assert.equal(source.includes("/api/php-compat"), false);
  }
});

test("admin dealer routes require admin and expose all Stage 4A methods", () => {
  assert.match(rootRoute, /requireAdmin\(\)/);
  assert.match(rootRoute, /export async function POST/);
  assert.match(detailRoute, /export async function PATCH/);
  assert.match(detailRoute, /export async function DELETE/);
  assert.match(statusRoute, /export async function PATCH/);
  assert.match(staffRoute, /export async function GET/);
  assert.match(staffRoute, /export async function PUT/);
});

test("dealer creation uses transactions, hashing, assignments, sessions, and audit events", () => {
  assert.match(repo, /prisma\.\$transaction/);
  assert.match(repo, /hashPassword/);
  assert.match(repo, /tx\.user\.create/);
  assert.match(repo, /tx\.dealerProfile\.create/);
  assert.match(repo, /dealerStaffAssignment\.createMany/);
  assert.match(repo, /authSession\.updateMany/);
  assert.match(repo, /tokenVersion:\s*\{\s*increment:\s*1\s*\}/);
  assert.match(repo, /ADMIN_DEALER_CREATED/);
  assert.match(repo, /ADMIN_DEALER_STAFF_ASSIGNMENTS_UPDATED/);
});

test("dealer mapper returns compatibility assignment aliases without passwords", () => {
  assert.match(mapper, /assignedstaff/);
  assert.match(mapper, /staffname/);
  assert.equal(mapper.includes("passwordHash"), false);
  assert.equal(mapper.includes("Dealer_Password"), false);
});

test("schemas normalize legacy aliases at the route boundary", () => {
  for (const alias of ["Dealer_Name", "Dealer_Email", "Dealer_Password", "Dealer_Number", "Dealer_Dealercode", "assignedstaff"]) {
    assert.match(schemas, new RegExp(alias));
  }
});

test("admin dealer frontend no longer uses unavailable Stage 3 or legacy dealer endpoints", () => {
  const combined = [dealerListPage, addDealerPage, editDealerPage, dealerFormCard].join("\n");
  for (const forbidden of [
    "Dealer creation is not available in Stage 3",
    "Dealer updates are not available in Stage 3",
    "Dealer deletion is not available in Stage 3",
    "/api/formdata1",
    "/api/updateDealer",
    "/api/delete",
    "/api/staffassign",
    "/api/dealer-status",
    "/api/dealer-code",
    "/api/php-compat",
  ]) {
    assert.equal(combined.includes(forbidden), false, forbidden);
  }
  assert.match(combined, /\/api\/admin\/dealers/);
  assert.match(combined, /credentials:\s*"include"/);
});