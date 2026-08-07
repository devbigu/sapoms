import "server-only";

import { prisma } from "@/server/db/prisma";
import type { AdminDashboardResult, AdminDashboardTopDealer } from "./admin-dashboard.types";

const TOP_DEALER_LIMIT = 10;

function monthKey(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function paiseToRupeeString(value: bigint | number | null | undefined) {
  const paise = typeof value === "bigint" ? value : BigInt(Math.trunc(Number(value ?? 0)));
  return (paise / BigInt(100)).toString();
}

export async function getPostgresAdminDashboard(): Promise<AdminDashboardResult> {
  const [dealerCount, orderCount, ordersForMonthlyTotals, topDealerGroups] = await prisma.$transaction([
    prisma.dealerProfile.count(),
    prisma.order.count(),
    prisma.order.findMany({
      select: {
        orderDate: true,
        finalPayableAmountPaise: true,
      },
      orderBy: {
        orderDate: "asc",
      },
    }),
    prisma.order.groupBy({
      by: ["dealerId"],
      _sum: {
        finalPayableAmountPaise: true,
      },
      orderBy: {
        _sum: {
          finalPayableAmountPaise: "desc",
        },
      },
      take: TOP_DEALER_LIMIT,
    }),
  ]);

  const monthlyTotals = new Map<string, bigint>();
  for (const order of ordersForMonthlyTotals) {
    const key = monthKey(order.orderDate);
    monthlyTotals.set(key, (monthlyTotals.get(key) ?? BigInt(0)) + order.finalPayableAmountPaise);
  }

  const dealerIds = topDealerGroups.map((group) => group.dealerId);
  const dealers = await prisma.dealerProfile.findMany({
    where: {
      id: {
        in: dealerIds,
      },
    },
    select: {
      id: true,
      businessName: true,
      dealerCode: true,
    },
  });
  const dealerById = new Map(dealers.map((dealer) => [dealer.id.toString(), dealer]));

  const topDealers: AdminDashboardTopDealer[] = topDealerGroups.map((group) => {
    const dealer = dealerById.get(group.dealerId.toString());
    return {
      dealerId: group.dealerId.toString(),
      dealerName: dealer?.businessName || dealer?.dealerCode || `Dealer ${group.dealerId.toString()}`,
      total: paiseToRupeeString(group._sum?.finalPayableAmountPaise),
    };
  });

  return {
    summary: {
      dealerCount,
      orderCount,
    },
    monthlyPerformance: Array.from(monthlyTotals.entries()).map(([month, total]) => ({
      month,
      total: paiseToRupeeString(total),
    })),
    topDealers,
    warnings: [],
  };
}