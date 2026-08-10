import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const addStaffPage = readFileSync("src/app/dashboard/admin/staff/addstaff/page.tsx", "utf8");
const editStaffPage = readFileSync("src/app/dashboard/admin/staff/[id]/page.tsx", "utf8");
const staffSchemas = readFileSync("src/server/modules/admin/staff/staff.schemas.ts", "utf8");
const staffRepo = readFileSync("src/server/modules/admin/staff/staff.repository.ts", "utf8");
const staffMapper = readFileSync("src/server/modules/admin/staff/staff.mapper.ts", "utf8");
const dealerRepo = readFileSync("src/server/modules/admin/dealers/dealers.repository.ts", "utf8");

test("admin staff mapper does not expose password fields", () => {
  assert.equal(staffMapper.includes("password"), false);
});

test("Add and Edit Staff show only business staff role choices", () => {
  for (const source of [addStaffPage, editStaffPage]) {
    assert.match(source, /label: 'Executive'/);
    assert.match(source, /label: 'Field Executive'/);
    assert.match(source, /label: 'RSM'/);
    assert.match(source, /label: 'NSM'/);
    assert.match(source, /Select a role/);
    assert.doesNotMatch(source, /label: 'Admin'/);
    assert.doesNotMatch(source, /label: 'Accountant'/);
    assert.doesNotMatch(source, /label: 'Staff'/);
    assert.doesNotMatch(source, /label: 'Dealer'/);
    assert.doesNotMatch(source, /value: 'ADMIN'/);
    assert.doesNotMatch(source, /value: 'ACCOUNTANT'/);
    assert.doesNotMatch(source, /value: 'DEALER'/);
    assert.doesNotMatch(source, /value: 'STAFF', label:/);
  }
});

test("Add and Edit Staff preserve Executive and Field Executive as STAFF plus existing subtype values", () => {
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
    assert.match(source, /value: 'NORTH', label: 'North'/);
    assert.match(source, /value: 'SOUTH', label: 'South'/);
    assert.match(source, /value: 'EAST', label: 'East'/);
    assert.match(source, /value: 'WEST', label: 'West'/);
    assert.match(source, /salesRegion: selectedRole\.authRole === "RSM" \? salesRegion : undefined/);
  }
});

test("staff API accepts only staff-management roles and requires concrete STAFF subtype", () => {
  assert.match(staffSchemas, /const createRole = z\.enum\(\["NSM", "RSM", "STAFF"\]\)/);
  assert.match(staffSchemas, /const updateRole = z\.enum\(\["STAFF", "RSM", "NSM"\]\)/);
  assert.doesNotMatch(staffSchemas, /"ADMIN", "NSM", "ACCOUNTANT", "RSM", "STAFF"/);
  assert.match(staffSchemas, /value\.role === "STAFF" && value\.staffRoleType !== "1" && value\.staffRoleType !== "2"/);
  assert.match(staffSchemas, /STAFF_ROLE_TYPE_REQUIRED/);
});

test("RSM region is required and cleared for non-RSM staff choices", () => {
  assert.match(staffSchemas, /value\.role === "RSM" && !value\.salesRegion/);
  assert.match(staffSchemas, /RSM_REGION_REQUIRED/);
  assert.match(staffSchemas, /value\.role && value\.role !== "RSM"\) value\.salesRegion = undefined/);
  assert.match(staffRepo, /staffRoleType: input\.role === "RSM" \? "RSM" : cleanOptional\(input\.staffRoleType\)/);
  assert.match(staffRepo, /salesRegion: input\.role === "RSM" \? input\.salesRegion : null/);
  assert.match(staffRepo, /if \(nextRole === "NSM"\) staffData\.staffRoleType = null/);
});

test("dealer staff assignment still uses normal STAFF profiles and keeps RSM separate", () => {
  assert.match(dealerRepo, /role: "STAFF", status: "ACTIVE", deletedAt: null/);
  assert.match(dealerRepo, /async function resolveRsm/);
  assert.match(dealerRepo, /role: "RSM"/);
  assert.match(dealerRepo, /staffProfile: \{ select: \{ salesRegion: true \} \}/);
});
