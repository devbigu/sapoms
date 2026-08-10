import { prisma } from "../src/server/db/prisma.js";

const TARGET_LEGACY_IDS = ["99", "73", "81", "50", "147", "218", "148", "230", "142"];

async function main() {
  const mode = process.argv[2] === "--apply" ? "apply" : "dry-run";
  const dealers = await prisma.dealerProfile.findMany({
    where: {
      legacyPhpId: { in: TARGET_LEGACY_IDS },
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          status: true,
          deletedAt: true,
        },
      },
      staffAssignments: {
        where: { active: true },
        select: { id: true, staffId: true, active: true },
      },
    },
    orderBy: { id: "asc" },
  });

  const summary = dealers.map((dealer) => ({
    id: dealer.id.toString(),
    legacyPhpId: dealer.legacyPhpId,
    businessName: dealer.businessName,
    userId: dealer.userId.toString(),
    email: dealer.user.email,
    status: dealer.user.status,
    dealerDeletedAt: dealer.deletedAt?.toISOString() ?? null,
    userDeletedAt: dealer.user.deletedAt?.toISOString() ?? null,
    activeAssignments: dealer.staffAssignments.length,
  }));

  console.log(JSON.stringify({ mode, found: summary.length, rows: summary }, null, 2));

  if (mode !== "apply") return;

  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const changed = [];
    for (const dealer of dealers) {
      if (dealer.deletedAt || dealer.user.deletedAt) {
        changed.push({ id: dealer.id.toString(), skipped: true, reason: "already_deleted" });
        continue;
      }

      await tx.dealerProfile.update({
        where: { id: dealer.id },
        data: { deletedAt: now },
      });
      await tx.user.update({
        where: { id: dealer.userId },
        data: {
          deletedAt: now,
          status: "INACTIVE",
          tokenVersion: { increment: 1 },
        },
      });
      await tx.authSession.updateMany({
        where: { userId: dealer.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.dealerStaffAssignment.updateMany({
        where: { dealerId: dealer.id, active: true },
        data: { active: false, removedAt: now },
      });

      changed.push({ id: dealer.id.toString(), deleted: true });
    }
    return changed;
  });

  console.log(JSON.stringify({ applied: true, result }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
