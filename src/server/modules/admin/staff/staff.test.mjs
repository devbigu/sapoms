import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const addStaffPage = readFileSync("src/app/dashboard/admin/staff/addstaff/page.tsx", "utf8");
const editStaffPage = readFileSync("src/app/dashboard/admin/staff/[id]/page.tsx", "utf8");
const staffSchemas = readFileSync("src/server/modules/admin/staff/staff.schemas.ts", "utf8");
const staffRepo = readFileSync("src/server/modules/admin/staff/staff.repository.ts", "utf8");
const staffMapper = readFileSync("src/server/modules/admin/staff/staff.mapper.ts", "utf8");
const dealerRepo = readFileSync("src/server/modules/admin/dealers/dealers.repository.ts", "utf8");
const staffRoute = readFileSync("src/app/api/admin/staff/route.ts", "utf8");

test("admin staff mapper does not expose password fields", () => {
  assert.equal(staffMapper.includes("password"), false);
});

test("Add and Edit Staff show only business staff role choices", () => {
  for (const source of [addStaffPage, editStaffPage]) {
    assert.match(source, /label: 'Staff'/);
    assert.match(source, /label: 'Executive'/);
    assert.match(source, /label: 'ASM'/);
    assert.match(source, /label: 'RSM'/);
    assert.match(source, /label: 'NSM'/);
    assert.match(source, /Select a role/);
    assert.doesNotMatch(source, /label: 'Admin'/);
    assert.doesNotMatch(source, /label: 'Accountant'/);
    assert.doesNotMatch(source, /label: 'Dealer'/);
    assert.doesNotMatch(source, /value: 'ADMIN'/);
    assert.doesNotMatch(source, /value: 'ACCOUNTANT'/);
    assert.doesNotMatch(source, /value: 'DEALER'/);
    assert.doesNotMatch(source, /value: 'STAFF', label:/);
  }
});

test("Add and Edit Staff map Executive and Staff labels to STAFF subtypes", () => {
  for (const source of [addStaffPage, editStaffPage]) {
    assert.match(source, /value: 'EXECUTIVE'[^\n]*authRole: 'STAFF'[^\n]*staffRoleType: '1'/);
    assert.match(source, /value: 'FIELD_EXECUTIVE'[^\n]*authRole: 'STAFF'[^\n]*staffRoleType: '2'/);
    assert.match(source, /role: selectedRole\.authRole/);
    assert.match(source, /staffRoleType: selectedRole\.staffRoleType/);
  }
  assert.match(editStaffPage, /if \(staffType === '2'\) return 'FIELD_EXECUTIVE'/);
  assert.match(editStaffPage, /if \(staffType === '1'\) return 'EXECUTIVE'/);
});

test("RSM and NSM map to their auth roles with RSM region only", () => {
  for (const source of [addStaffPage, editStaffPage]) {
    assert.match(source, /value: 'RSM'[^\n]*authRole: 'RSM'[^\n]*staffRoleType: 'RSM'/);
    assert.match(source, /value: 'NSM'[^\n]*authRole: 'NSM'[^\n]*staffRoleType: undefined/);
    assert.match(source, /role === "RSM"|role === 'RSM'/);
    assert.match(source, /SALES_REGION_OPTIONS/);
    assert.match(source, /salesRegion: selectedRole\.authRole === 'RSM' \? salesRegion : undefined/);
  }
});

test("staff API accepts only staff-management roles and requires concrete STAFF subtype", () => {
  assert.match(staffSchemas, /const createRole = z\.enum\(\["NSM", "RSM", "ASM", "STAFF"\]\)/);
  assert.match(staffSchemas, /const updateRole = z\.enum\(\["STAFF", "RSM", "ASM", "NSM"\]\)/);
  assert.doesNotMatch(staffSchemas, /"ADMIN", "NSM", "ACCOUNTANT", "RSM", "STAFF"/);
  assert.match(staffSchemas, /value\.role === "STAFF" && value\.staffRoleType !== "1" && value\.staffRoleType !== "2"/);
  assert.match(staffSchemas, /STAFF_ROLE_TYPE_REQUIRED/);
});

test("RSM region is required and cleared for non-RSM staff choices", () => {
  assert.match(staffSchemas, /value\.role === "RSM" && !value\.salesRegion/);
  assert.match(staffSchemas, /RSM_REGION_REQUIRED/);
  assert.match(staffSchemas, /value\.role && value\.role !== "RSM"\) value\.salesRegion = undefined/);
  assert.match(staffRepo, /input\.role === "ASM" \? "ASM"/);
  assert.match(staffRepo, /resolveRsm/);
  assert.match(staffRepo, /resolveAsm/);
  assert.match(staffRepo, /assertSubset/);
  assert.match(staffRepo, /salesRegion: input\.role === "RSM" \? input\.salesRegion : null/);
  assert.match(staffRepo, /staffData\.staffRoleType = null/);
});

test("dealer staff assignment accepts staff-like profiles and keeps RSM region selection separate", () => {
  assert.match(dealerRepo, /role: \{ in: \["STAFF", "RSM", "ASM"\] \}, status: "ACTIVE", deletedAt: null/);
  assert.match(dealerRepo, /async function resolveRsm/);
  assert.match(dealerRepo, /role: "RSM"/);
  assert.match(dealerRepo, /staffProfile: \{ select: \{ salesRegion: true \} \}/);
});

test("staff directory route allows staff-like reads for dealer assignment without opening write access", () => {
  assert.match(staffRoute, /const actor = await requireAuth\(\)/);
  assert.match(staffRoute, /isAdminLike\(actor\) \|\| isStaffLike\(actor\)/);
  assert.match(staffRoute, /eventType: "STAFF_DIRECTORY_VIEWED"/);
  assert.match(staffRoute, /const actor = await requireAdmin\(\)/);
});
