import "server-only";

import { prisma } from "@/server/db/prisma";
import { mapPostgresUserToLegacyProfile, getProfileId } from "@/server/auth/legacy-auth.mapper";
import { verifyPassword } from "@/server/auth/password";
import { LEGACY_ROLE_MAP, type AuthRole, type LegacyRoleType } from "./types";

export type AuthenticatedPostgresUser = {
  userId: bigint;
  role: AuthRole;
  email: string;
  displayName: string;
  tokenVersion: number;
  profileId: bigint;
  profile: Record<string, unknown>;
};

export interface PostgresAuthenticationProvider {
  authenticate(input: {
    email: string;
    password: string;
    roleType?: string;
  }): Promise<AuthenticatedPostgresUser>;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function displayNameFromProfile(profile: Record<string, unknown>, role: AuthRole) {
  const keys = role === "DEALER" ? ["Dealer_Name", "name"] : ["name", "staff_name", "ADMIN_NAME"];
  for (const key of keys) {
    const value = profile[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return "";
}

export class PrismaPostgresAuthenticationProvider implements PostgresAuthenticationProvider {
  async authenticate(input: { email: string; password: string; roleType?: string }): Promise<AuthenticatedPostgresUser> {
    const normalizedEmail = normalizeEmail(input.email);
    const expectedRole = input.roleType ? LEGACY_ROLE_MAP[input.roleType as LegacyRoleType] : undefined;
    if (!normalizedEmail || (input.roleType && !expectedRole)) throw new Error("Invalid credentials");

    const user = await prisma.user.findUnique({
      where: { normalizedEmail },
      include: {
        adminProfile: true,
        accountantProfile: true,
        staffProfile: true,
        dealerProfile: true,
      },
    });

    if (!user || user.deletedAt || user.status !== "ACTIVE") throw new Error("Invalid credentials");
    if (expectedRole && user.role !== expectedRole) throw new Error("Invalid credentials");
    if (!(await verifyPassword(input.password, user.passwordHash))) throw new Error("Invalid credentials");

    const profile = mapPostgresUserToLegacyProfile(user);
    const profileId = getProfileId(user);

    return {
      userId: user.id,
      role: user.role,
      email: user.email,
      displayName: displayNameFromProfile(profile, user.role),
      tokenVersion: user.tokenVersion,
      profileId,
      profile,
    };
  }
}

export const postgresAuthenticationProvider = new PrismaPostgresAuthenticationProvider();