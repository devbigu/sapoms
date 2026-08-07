export type AdminDashboardMonthlyPerformance = {
  month: string;
  total: string;
};

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
  topDealers: AdminDashboardTopDealer[];
  warnings: string[];
};