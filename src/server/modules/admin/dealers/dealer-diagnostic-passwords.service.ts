import "server-only";

import { prisma } from "@/server/db/prisma";
import { AdminRouteError } from "@/server/admin/admin-errors";
import { hashPassword } from "@/server/auth/password";
import type { AuthActor } from "./dealers.types";

const MIN_PASSWORD_LENGTH = 5;
const MAX_PASSWORD_LENGTH = 200;
const MIN_EXPIRY_HOURS = 1;
const MAX_EXPIRY_HOURS = 24 * 90;

type DiagnosticPasswordRow = {
  id: bigint;
  expires_at: Date;
  revoked_at: Date | null;
  last_used_at: Date | null;
  created_at: Date;
  created_by_email: string;
  created_by_name: string | null;
};

function invalid(message: string, code = "INVALID_REQUEST") {
  return new AdminRouteError("INVALID_REQUEST", message, { code });
}

function notFound(message: string, code = "NOT_FOUND") {
  return new AdminRouteError("NOT_FOUND", message, { code });
}

function parsePassword(value: unknown) {
  const password = String(value ?? "");
  if (password.length < MIN_PASSWORD_LENGTH) throw invalid(`Temporary password must be at least ${MIN_PASSWORD_LENGTH} characters`, "PASSWORD_TOO_SHORT");
  if (password.length > MAX_PASSWORD_LENGTH) throw invalid("Temporary password is too long", "PASSWORD_TOO_LONG");
  return password;
}

function parseExpiryHours(value: unknown) {
  const parsed = Number(String(value ?? "").trim());
  if (!Number.isInteger(parsed) || parsed < MIN_EXPIRY_HOURS || parsed > MAX_EXPIRY_HOURS) {
    throw invalid(`Expiry must be between ${MIN_EXPIRY_HOURS} and ${MAX_EXPIRY_HOURS} hours`, "INVALID_EXPIRY");
  }
  return parsed;
}

function mapRecord(record: DiagnosticPasswordRow) {
  return {
    id: record.id.toString(),
    expiresAt: record.expires_at.toISOString(),
    revokedAt: record.revoked_at?.toISOString() ?? null,
    lastUsedAt: record.last_used_at?.toISOString() ?? null,
    createdAt: record.created_at.toISOString(),
    createdBy: record.created_by_name || record.created_by_email,
  };
}

async function loadRecord(tx: typeof prisma, id: bigint) {
  const rows = await tx.$queryRaw<DiagnosticPasswordRow[]>`
    SELECT dp.id, dp.expires_at, dp.revoked_at, dp.last_used_at, dp.created_at,
           u.email AS created_by_email, ap.display_name AS created_by_name
    FROM dealer_diagnostic_passwords dp
    JOIN users u ON u.id = dp.created_by_user_id
    LEFT JOIN admin_profiles ap ON ap.user_id = u.id
    WHERE dp.id = ${id}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function getActiveDealerDiagnosticPassword(dealerId: bigint) {
  const rows = await prisma.$queryRaw<DiagnosticPasswordRow[]>`
    SELECT dp.id, dp.expires_at, dp.revoked_at, dp.last_used_at, dp.created_at,
           u.email AS created_by_email, ap.display_name AS created_by_name
    FROM dealer_diagnostic_passwords dp
    JOIN users u ON u.id = dp.created_by_user_id
    LEFT JOIN admin_profiles ap ON ap.user_id = u.id
    WHERE dp.dealer_id = ${dealerId}
      AND dp.revoked_at IS NULL
      AND dp.expires_at > now()
    ORDER BY dp.created_at DESC
    LIMIT 1
  `;
  return rows[0] ? mapRecord(rows[0]) : null;
}

export async function createDealerDiagnosticPassword(dealerId: bigint, body: unknown, actor: AuthActor) {
  const input = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const password = parsePassword(input.password ?? input.temporaryPassword);
  const expiryHours = parseExpiryHours(input.expiryHours ?? input.expiresInHours);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiryHours * 60 * 60 * 1000);
  const passwordHash = await hashPassword(password);

  return prisma.$transaction(async (tx) => {
    const dealer = await tx.dealerProfile.findFirst({ where: { id: dealerId, deletedAt: null, user: { deletedAt: null } }, select: { id: true } });
    if (!dealer) throw notFound("Dealer not found", "DEALER_NOT_FOUND");

    await tx.$executeRaw`
      UPDATE dealer_diagnostic_passwords
      SET revoked_at = ${now}, revoked_by_user_id = ${actor.userId}
      WHERE dealer_id = ${dealerId} AND revoked_at IS NULL
    `;

    const inserted = await tx.$queryRaw<Array<{ id: bigint }>>`
      INSERT INTO dealer_diagnostic_passwords (dealer_id, password_hash, expires_at, created_by_user_id)
      VALUES (${dealerId}, ${passwordHash}, ${expiresAt}, ${actor.userId})
      RETURNING id
    `;
    const createdId = inserted[0]?.id;
    if (!createdId) throw invalid("Diagnostic password could not be saved", "CREATE_FAILED");
    const created = await loadRecord(tx as typeof prisma, createdId);
    if (!created) throw invalid("Diagnostic password could not be loaded", "CREATE_FAILED");

    await tx.authAuditLog.create({
      data: {
        sessionId: actor.sessionId,
        role: actor.role as never,
        eventType: "ADMIN_DEALER_DIAGNOSTIC_PASSWORD_CREATED",
        metadata: { userId: actor.userId.toString(), dealerId: dealerId.toString(), diagnosticPasswordId: created.id.toString(), expiresAt: expiresAt.toISOString() },
      },
    });

    return mapRecord(created);
  });
}

export async function revokeDealerDiagnosticPassword(dealerId: bigint, actor: AuthActor) {
  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.$executeRaw`
      UPDATE dealer_diagnostic_passwords
      SET revoked_at = ${now}, revoked_by_user_id = ${actor.userId}
      WHERE dealer_id = ${dealerId} AND revoked_at IS NULL
    `;
    await tx.authAuditLog.create({
      data: {
        sessionId: actor.sessionId,
        role: actor.role as never,
        eventType: "ADMIN_DEALER_DIAGNOSTIC_PASSWORD_REVOKED",
        metadata: { userId: actor.userId.toString(), dealerId: dealerId.toString(), count: updated },
      },
    });
    return updated;
  });
  return { revoked: Number(result) };
}