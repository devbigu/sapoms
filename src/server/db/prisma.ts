import { PrismaClient } from "@prisma/client";

const prismaGlobal = globalThis as typeof globalThis & {
  __omsonsPrisma?: PrismaClient;
};

export const prisma = prismaGlobal.__omsonsPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  prismaGlobal.__omsonsPrisma = prisma;
}
