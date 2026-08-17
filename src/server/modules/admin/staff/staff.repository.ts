import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { paginationToPrisma } from "@/server/admin/admin-pagination";
import { AdminRouteError } from "@/server/admin/admin-errors";
import { normalizeEmail } from "@/server/auth/providers/postgres-auth.provider";
import { hashPassword } from "@/server/auth/password";
import type { AdminStaffListInput, AdminStaffRecord, CreateAdminStaffInput, UpdateAdminStaffInput } from "./staff.types";
import type { AuthActor } from "@/server/auth/session";

function buildWhere(input: AdminStaffListInput): Prisma.StaffProfileWhereInput {
  const search = input.search.trim();
  if (!search) return {};
  return {
    OR: [
      { displayName: { contains: search, mode: "insensitive" } },
      { designation: { contains: search, mode: "insensitive" } },
      { location: { contains: search, mode: "insensitive" } },
      { user: { email: { contains: search, mode: "insensitive" } } },
      { user: { username: { contains: search, mode: "insensitive" } } },
    ],
  };
}

const include = {
  user: { select: { id: true, email: true, username: true, status: true, role: true } },
  parentRsm: { select: { id: true, displayName: true, user: { select: { id: true, email: true } } } },
  parentAsm: { select: { id: true, displayName: true, user: { select: { id: true, email: true } } } },
} satisfies Prisma.StaffProfileInclude;

function conflict(message: string, code: string) {
  return new AdminRouteError("CONFLICT", message, { code });
}

function invalid(message: string, code: string, details?: Record<string, unknown>) {
  return new AdminRouteError("INVALID_REQUEST", message, { code, ...details });
}

function notFound(message: string, code = "NOT_FOUND") {
  return new AdminRouteError("NOT_FOUND", message, { code });
}

function cleanOptional(value: string | undefined) {
  return value === undefined ? undefined : value.trim();
}

function uniqueStates(states?: string[]) {
  return [...new Set((states ?? []).map((state) => state.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function parseId(value: string | undefined, code: string) {
  if (!value) return null;
  try {
    return BigInt(value);
  } catch {
    throw invalid("Invalid staff hierarchy id", code, { value });
  }
}

function assertSubset(selected: string[], allowed: string[], code: string) {
  const allowedSet = new Set(allowed.map((state) => state.toLowerCase()));
  const outside = selected.filter((state) => !allowedSet.has(state.toLowerCase()));
  if (outside.length) throw invalid("Selected states must be within the parent RSM scope", code, { states: outside });
}

function buildSyntheticRecord(args: {
  id: bigint;
  displayName: string;
  designation: string | null;
  location: string | null;
  staffRoleType: string | null;
  salesRegion: AdminStaffRecord["salesRegion"];
  user: AdminStaffRecord["user"];
}): AdminStaffRecord {
  return {
    id: args.id,
    displayName: args.displayName,
    designation: args.designation,
    location: args.location,
    staffRoleType: args.staffRoleType,
    salesRegion: args.salesRegion,
    parentRsmId: null,
    parentAsmId: null,
    assignedStates: [],
    parentRsm: null,
    parentAsm: null,
    user: args.user,
  };
}

async function audit(tx: Prisma.TransactionClient, actor: AuthActor, eventType: string, metadata: Record<string, unknown>) {
  await tx.authAuditLog.create({
    data: { sessionId: actor.sessionId, role: actor.role, eventType, metadata: { ...metadata, userId: actor.userId.toString() } },
  });
}

async function ensureUniqueEmail(tx: Prisma.TransactionClient, email: string, currentUserId?: bigint) {
  const normalizedEmail = normalizeEmail(email);
  const duplicate = await tx.user.findUnique({ where: { normalizedEmail }, select: { id: true } });
  if (duplicate && duplicate.id !== currentUserId) throw conflict("Email already exists", "EMAIL_CONFLICT");
  return normalizedEmail;
}

async function resolveRsm(tx: Prisma.TransactionClient, id: bigint | null) {
  if (!id) throw invalid("RSM parent is required", "RSM_PARENT_REQUIRED");
  const rsm = await tx.staffProfile.findFirst({
    where: { id, user: { role: "RSM", status: "ACTIVE", deletedAt: null } },
    select: { id: true, assignedStates: true },
  });
  if (!rsm) throw invalid("Selected RSM was not found", "RSM_PARENT_INVALID", { rsmId: id.toString() });
  return rsm;
}

async function resolveAsm(tx: Prisma.TransactionClient, id: bigint | null) {
  if (!id) throw invalid("ASM parent is required", "ASM_PARENT_REQUIRED");
  const asm = await tx.staffProfile.findFirst({
    where: { id, user: { role: "ASM", status: "ACTIVE", deletedAt: null } },
    select: { id: true, parentRsmId: true },
  });
  if (!asm?.parentRsmId) throw invalid("Selected ASM was not found or has no RSM parent", "ASM_PARENT_INVALID", { asmId: id.toString() });
  return { id: asm.id, parentRsmId: asm.parentRsmId };
}

export class PostgresAdminStaffRepository {
  async list(input: AdminStaffListInput): Promise<{ items: AdminStaffRecord[]; total: number }> {
    const where = buildWhere(input);
    const { skip, take } = paginationToPrisma(input);
    const [items, total] = await prisma.$transaction([
      prisma.staffProfile.findMany({ where, include, orderBy: { id: "desc" }, skip, take }),
      prisma.staffProfile.count({ where }),
    ]);
    return { items, total };
  }

  async findById(staffId: bigint): Promise<AdminStaffRecord | null> {
    return prisma.staffProfile.findUnique({ where: { id: staffId }, include });
  }

  async create(input: CreateAdminStaffInput, actor: AuthActor): Promise<AdminStaffRecord> {
    return prisma.$transaction(async (tx) => {
      const normalizedEmail = await ensureUniqueEmail(tx, input.email);
      const passwordHash = await hashPassword(input.password);
      let parentRsmId: bigint | null = null;
      let parentAsmId: bigint | null = null;
      let assignedStates = uniqueStates(input.assignedStates);

      if (input.role === "ASM") {
        const rsm = await resolveRsm(tx, parseId(input.parentRsmId, "ASM_RSM_INVALID"));
        assertSubset(assignedStates, rsm.assignedStates, "ASM_STATES_OUTSIDE_RSM_SCOPE");
        parentRsmId = rsm.id;
      } else if (input.role === "STAFF" && input.staffRoleType === "1") {
        const asm = await resolveAsm(tx, parseId(input.parentAsmId, "EXECUTIVE_ASM_INVALID"));
        parentAsmId = asm.id;
        parentRsmId = asm.parentRsmId;
        assignedStates = [];
      } else if (input.role === "STAFF" && input.staffRoleType === "2") {
        const rsm = await resolveRsm(tx, parseId(input.parentRsmId, "STAFF_RSM_INVALID"));
        parentRsmId = rsm.id;
        assignedStates = [];
      } else if (input.role !== "RSM") {
        assignedStates = [];
      }

      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          normalizedEmail,
          username: normalizedEmail,
          normalizedUsername: normalizedEmail,
          passwordHash,
          role: input.role,
          status: input.status ?? "ACTIVE",
        },
      });

      if (input.role === "NSM") {
        const profile = await tx.adminProfile.create({ data: { userId: user.id, displayName: input.name } });
        await audit(tx, actor, "ADMIN_NSM_CREATED", { userId: user.id.toString() });
        return buildSyntheticRecord({
          id: profile.id,
          displayName: profile.displayName,
          designation: "NSM",
          location: null,
          staffRoleType: "NSM",
          salesRegion: null,
          user: { id: user.id, email: user.email, username: user.username, status: user.status, role: user.role },
        });
      }

      const staff = await tx.staffProfile.create({
        data: {
          userId: user.id,
          parentRsmId,
          parentAsmId,
          displayName: input.name,
          designation: cleanOptional(input.designation),
          location: cleanOptional(input.location),
          staffRoleType: input.role === "RSM" ? "RSM" : input.role === "ASM" ? "ASM" : cleanOptional(input.staffRoleType),
          salesRegion: input.role === "RSM" ? input.salesRegion : null,
          assignedStates,
        },
        include,
      });
      await audit(tx, actor, input.role === "RSM" ? "ADMIN_RSM_CREATED" : "ADMIN_STAFF_CREATED", { staffId: staff.id.toString(), region: staff.salesRegion, parentRsmId: staff.parentRsmId?.toString(), parentAsmId: staff.parentAsmId?.toString() });
      return staff;
    });
  }

  async update(staffId: bigint, input: UpdateAdminStaffInput, actor: AuthActor): Promise<AdminStaffRecord> {
    return prisma.$transaction(async (tx) => {
      const current = await tx.staffProfile.findUnique({ where: { id: staffId }, include: { user: true } });
      if (!current) throw notFound("Staff member not found", "STAFF_NOT_FOUND");
      const userData: Prisma.UserUpdateInput = {};
      const staffData: Prisma.StaffProfileUpdateInput = {};
      if (input.email !== undefined) {
        const normalizedEmail = await ensureUniqueEmail(tx, input.email, current.userId);
        userData.email = normalizedEmail;
        userData.normalizedEmail = normalizedEmail;
        userData.username = normalizedEmail;
        userData.normalizedUsername = normalizedEmail;
      }
      if (input.status !== undefined) userData.status = input.status;
      if (input.role !== undefined) userData.role = input.role;
      if (input.name !== undefined) staffData.displayName = input.name;
      if (input.designation !== undefined) staffData.designation = input.designation;
      if (input.location !== undefined) staffData.location = input.location;
      if (input.staffRoleType !== undefined) staffData.staffRoleType = input.staffRoleType;
      const nextRole = input.role ?? current.user.role;
      const nextStaffRoleType = nextRole === "ASM" ? "ASM" : nextRole === "RSM" ? "RSM" : input.staffRoleType ?? current.staffRoleType;

      if (nextRole === "RSM") {
        staffData.staffRoleType = "RSM";
        staffData.parentRsm = { disconnect: true };
        staffData.parentAsm = { disconnect: true };
        if (input.salesRegion !== undefined) staffData.salesRegion = input.salesRegion;
        if (input.assignedStates !== undefined) staffData.assignedStates = uniqueStates(input.assignedStates);
      } else if (nextRole === "ASM") {
        const rsm = await resolveRsm(tx, parseId(input.parentRsmId ?? current.parentRsmId?.toString(), "ASM_RSM_INVALID"));
        const assignedStates = uniqueStates(input.assignedStates ?? current.assignedStates);
        assertSubset(assignedStates, rsm.assignedStates, "ASM_STATES_OUTSIDE_RSM_SCOPE");
        staffData.staffRoleType = "ASM";
        staffData.salesRegion = null;
        staffData.parentRsm = { connect: { id: rsm.id } };
        staffData.parentAsm = { disconnect: true };
        staffData.assignedStates = assignedStates;
      } else if (nextRole === "STAFF" && nextStaffRoleType === "1") {
        const asm = await resolveAsm(tx, parseId(input.parentAsmId ?? current.parentAsmId?.toString(), "EXECUTIVE_ASM_INVALID"));
        staffData.staffRoleType = "1";
        staffData.salesRegion = null;
        staffData.parentAsm = { connect: { id: asm.id } };
        staffData.parentRsm = { connect: { id: asm.parentRsmId } };
        staffData.assignedStates = [];
      } else if (nextRole === "STAFF" && nextStaffRoleType === "2") {
        const rsm = await resolveRsm(tx, parseId(input.parentRsmId ?? current.parentRsmId?.toString(), "STAFF_RSM_INVALID"));
        staffData.staffRoleType = "2";
        staffData.salesRegion = null;
        staffData.parentRsm = { connect: { id: rsm.id } };
        staffData.parentAsm = { disconnect: true };
        staffData.assignedStates = [];
      } else if (nextRole === "NSM") {
        staffData.staffRoleType = null;
        staffData.salesRegion = null;
        staffData.parentRsm = { disconnect: true };
        staffData.parentAsm = { disconnect: true };
        staffData.assignedStates = [];
      }
      if (Object.keys(userData).length) await tx.user.update({ where: { id: current.userId }, data: userData });
      if (Object.keys(staffData).length) await tx.staffProfile.update({ where: { id: staffId }, data: staffData });
      await audit(tx, actor, "ADMIN_STAFF_UPDATED", { staffId: staffId.toString(), role: nextRole });
      return tx.staffProfile.findUniqueOrThrow({ where: { id: staffId }, include });
    });
  }
}

export const adminStaffRepository = new PostgresAdminStaffRepository();
