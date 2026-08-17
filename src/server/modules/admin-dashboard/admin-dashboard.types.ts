export type SalesRegionKey = "NORTH_1" | "NORTH_2" | "SOUTH_1" | "SOUTH_2" | "WEST_1" | "WEST_2" | "EAST" | "ROM" | "CENTRAL";

export type AdminDashboardMonthlyPerformance = {
  month: string;
  total: string;
};

export type AdminDashboardRegionalPerformance = { month: string } & Record<SalesRegionKey, string>;

export type AdminDashboardTopDealer = {
  dealerId: string;
  dealerName: string;
  total: string;
};

export type AdminDashboardResult = {
  summary: {
    dealerCount: number;
    orderCount: number;
  };
  monthlyPerformance: AdminDashboardMonthlyPerformance[];
  regionalPerformance: AdminDashboardRegionalPerformance[];
  topDealers: AdminDashboardTopDealer[];
  topDistributorsByRegion: Record<SalesRegionKey, AdminDashboardTopDealer[]>;
  warnings: string[];
};
