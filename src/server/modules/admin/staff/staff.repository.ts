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
} satisfies Prisma.StaffProfileInclude;

function conflict(message: string, code: string) {
  return new AdminRouteError("CONFLICT", message, { code });
}

function notFound(message: string, code = "NOT_FOUND") {
  return new AdminRouteError("NOT_FOUND", message, { code });
}

function cleanOptional(value: string | undefined) {
  return value === undefined ? undefined : value.trim();
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
          displayName: input.name,
          designation: cleanOptional(input.designation),
          location: cleanOptional(input.location),
          staffRoleType: input.role === "RSM" ? "RSM" : cleanOptional(input.staffRoleType),
          salesRegion: input.role === "RSM" ? input.salesRegion : null,
        },
        include,
      });
      await audit(tx, actor, input.role === "RSM" ? "ADMIN_RSM_CREATED" : "ADMIN_STAFF_CREATED", { staffId: staff.id.toString(), region: staff.salesRegion });
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
      if (nextRole === "RSM") {
        staffData.staffRoleType = "RSM";
        if (input.salesRegion !== undefined) staffData.salesRegion = input.salesRegion;
      } else {
        staffData.salesRegion = null;
        if (nextRole === "NSM") staffData.staffRoleType = null;
      }
      if (Object.keys(userData).length) await tx.user.update({ where: { id: current.userId }, data: userData });
      if (Object.keys(staffData).length) await tx.staffProfile.update({ where: { id: staffId }, data: staffData });
      await audit(tx, actor, "ADMIN_STAFF_UPDATED", { staffId: staffId.toString(), role: nextRole });
      return tx.staffProfile.findUniqueOrThrow({ where: { id: staffId }, include });
    });
  }
}

export const adminStaffRepository = new PostgresAdminStaffRepository();
