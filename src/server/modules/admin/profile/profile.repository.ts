import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { AdminRouteError } from "@/server/admin/admin-errors";
import type { AdminActor } from "@/server/admin/admin.types";
import type { AdminProfileRecord, AdminProfileUpdateInput } from "./profile.types";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export class PostgresAdminProfileRepository {
  async getByUserId(userId: bigint): Promise<AdminProfileRecord | null> {
    return prisma.adminProfile.findUnique({
      where: { userId },
      include: { user: { select: { id: true, email: true, role: true } } },
    });
  }

  async update(actor: AdminActor, input: AdminProfileUpdateInput, audit: { requestId: string }): Promise<AdminProfileRecord> {
    const existing = await prisma.adminProfile.findUnique({
      where: { userId: actor.userId },
      include: { user: { select: { id: true, email: true, role: true, passwordHash: true } } },
    });

    if (!existing) throw new AdminRouteError("NOT_FOUND", "Admin profile not found");

    let nextPasswordHash: string | undefined;
    if (input.newPassword) {
      const ok = await verifyPassword(input.currentPassword ?? "", existing.user.passwordHash);
      if (!ok) throw new AdminRouteError("FORBIDDEN", "Current password is incorrect");
      nextPasswordHash = await hashPassword(input.newPassword);
    }

    try {
      return await prisma.$transaction(async (tx) => {
        const userUpdate: Prisma.UserUpdateInput = {};
        if (input.email !== undefined) {
          userUpdate.email = input.email;
          userUpdate.normalizedEmail = normalizeEmail(input.email);
        }
        if (nextPasswordHash) {
          userUpdate.passwordHash = nextPasswordHash;
          userUpdate.tokenVersion = { increment: 1 };
        }

        if (Object.keys(userUpdate).length > 0) {
          await tx.user.update({ where: { id: actor.userId }, data: userUpdate });
        }

        const profile = await tx.adminProfile.update({
          where: { userId: actor.userId },
          data: {
            ...(input.name !== undefined ? { displayName: input.name } : {}),
            ...(input.phone !== undefined ? { phone: input.phone } : {}),
            ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
          },
          include: { user: { select: { id: true, email: true, role: true } } },
        });

        if (nextPasswordHash) {
          await tx.authSession.updateMany({
            where: { userId: actor.userId, id: { not: actor.sessionId }, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }

        await tx.authAuditLog.create({
          data: {
            sessionId: actor.sessionId,
            role: actor.role,
            eventType: "ADMIN_PROFILE_UPDATED",
            metadata: {
              userId: actor.userId.toString(),
              route: "/api/admin/profile",
              requestId: audit.requestId,
              passwordChanged: Boolean(nextPasswordHash),
            },
          },
        });

        return profile;
      });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        throw new AdminRouteError("CONFLICT", "Email is already in use");
      }
      throw error;
    }
  }
}

export const adminProfileRepository = new PostgresAdminProfileRepository();