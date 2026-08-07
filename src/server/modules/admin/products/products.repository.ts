import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { paginationToPrisma } from "@/server/admin/admin-pagination";
import type { AdminProductListInput, AdminProductRecord } from "./products.types";

function buildWhere(input: AdminProductListInput): Prisma.ProductWhereInput {
  const search = input.search.trim();
  if (!search) return {};
  return {
    OR: [
      { name: { contains: search, mode: "insensitive" } },
      { productCode: { contains: search, mode: "insensitive" } },
      { category: { name: { contains: search, mode: "insensitive" } } },
      { variants: { some: { sku: { contains: search, mode: "insensitive" } } } },
      { variants: { some: { catalogueNumber: { contains: search, mode: "insensitive" } } } },
    ],
  };
}

const include = {
  category: { select: { id: true, name: true, slug: true } },
  variants: { orderBy: { id: "asc" as const } },
} satisfies Prisma.ProductInclude;

export class PostgresAdminProductRepository {
  async list(input: AdminProductListInput): Promise<{ items: AdminProductRecord[]; total: number }> {
    const where = buildWhere(input);
    const { skip, take } = paginationToPrisma(input);
    const [items, total] = await prisma.$transaction([
      prisma.product.findMany({ where, include, orderBy: { id: "desc" }, skip, take }),
      prisma.product.count({ where }),
    ]);
    return { items, total };
  }

  async findById(productId: bigint): Promise<AdminProductRecord | null> {
    return prisma.product.findUnique({ where: { id: productId }, include });
  }
}

export const adminProductRepository = new PostgresAdminProductRepository();