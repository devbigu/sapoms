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
  diagnosticPasswordId?: bigint;
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

function normalizeLoginIdentifier(value: string): string {
  return value.trim().toLowerCase();
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
    const loginIdentifier = normalizeLoginIdentifier(input.email);
    const normalizedEmail = normalizeEmail(input.email);
    const expectedRole = input.roleType ? LEGACY_ROLE_MAP[input.roleType as LegacyRoleType] : undefined;
    if (!loginIdentifier || (input.roleType && !expectedRole)) throw new Error("Invalid credentials");

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { normalizedEmail },
          { normalizedUsername: loginIdentifier },
          { dealerProfile: { dealerCode: input.email.trim() } },
          { dealerProfile: { legacyPhpId: input.email.trim() } },
        ],
      },
      include: {
        adminProfile: true,
        accountantProfile: true,
        staffProfile: true,
        dealerProfile: true,
      },
    });

    if (!user || user.deletedAt || user.status !== "ACTIVE") throw new Error("Invalid credentials");
    if (expectedRole && user.role !== expectedRole) throw new Error("Invalid credentials");

    let diagnosticPasswordId: bigint | undefined;
    const passwordMatches = await verifyPassword(input.password, user.passwordHash);
    if (!passwordMatches) {
      if (user.role !== "DEALER" || !user.dealerProfile?.id) throw new Error("Invalid credentials");
      const now = new Date();
      const candidates = await prisma.$queryRaw<Array<{ id: bigint; password_hash: string }>>`
        SELECT id, password_hash
        FROM dealer_diagnostic_passwords
        WHERE dealer_id = ${user.dealerProfile.id}
          AND revoked_at IS NULL
          AND expires_at > ${now}
        ORDER BY created_at DESC
        LIMIT 5
      `;
      for (const candidate of candidates) {
        if (await verifyPassword(input.password, candidate.password_hash)) {
          diagnosticPasswordId = candidate.id;
          await prisma.$executeRaw`
            UPDATE dealer_diagnostic_passwords
            SET last_used_at = ${now}
            WHERE id = ${candidate.id}
          `;
          break;
        }
      }
      if (!diagnosticPasswordId) throw new Error("Invalid credentials");
    }

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
      diagnosticPasswordId,
    };
  }
}

export const postgresAuthenticationProvider = new PrismaPostgresAuthenticationProvider();