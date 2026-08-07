import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { paginationToPrisma } from "@/server/admin/admin-pagination";
import type { AdminStaffListInput, AdminStaffRecord } from "./staff.types";

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
  user: { select: { id: true, email: true, username: true, status: true } },
} satisfies Prisma.StaffProfileInclude;

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
}

export const adminStaffRepository = new PostgresAdminStaffRepository();