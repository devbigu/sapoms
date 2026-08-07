import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { paginationToPrisma } from "@/server/admin/admin-pagination";
import type { AdminAccountantListInput, AdminAccountantRecord } from "./accountants.types";

function buildWhere(input: AdminAccountantListInput): Prisma.AccountantProfileWhereInput {
  const search = input.search.trim();
  if (!search) return {};
  return {
    OR: [
      { displayName: { contains: search, mode: "insensitive" } },
      { designation: { contains: search, mode: "insensitive" } },
      { user: { email: { contains: search, mode: "insensitive" } } },
    ],
  };
}

const include = {
  user: { select: { id: true, email: true, status: true } },
} satisfies Prisma.AccountantProfileInclude;

export class PostgresAdminAccountantRepository {
  async list(input: AdminAccountantListInput): Promise<{ items: AdminAccountantRecord[]; total: number }> {
    const where = buildWhere(input);
    const { skip, take } = paginationToPrisma(input);
    const [items, total] = await prisma.$transaction([
      prisma.accountantProfile.findMany({ where, include, orderBy: { id: "desc" }, skip, take }),
      prisma.accountantProfile.count({ where }),
    ]);
    return { items, total };
  }

  async findById(accountantId: bigint): Promise<AdminAccountantRecord | null> {
    return prisma.accountantProfile.findUnique({ where: { id: accountantId }, include });
  }
}

export const adminAccountantRepository = new PostgresAdminAccountantRepository();