export type AdminOrderListInput = {
  page: number;
  pageSize: number;
  search: string;
  status: string;
  dealerId?: bigint;
  staffId?: bigint;
  dateFrom?: Date;
  dateTo?: Date;
};

export type AdminOrderItemRecord = {
  id: bigint;
  legacyPhpOrderItemId: string | null;
  productVariantId: bigint | null;
  productNameSnapshot: string;
  catalogueNumberSnapshot: string;
  categorySnapshot: string | null;
  quantityPacks: number;
  packSize: number;
  totalPieces: number;
  unitPricePaise: bigint;
  packPricePaise: bigint;
  listPriceTotalPaise: bigint;
  discountAmountPaise: bigint;
  finalAmountPaise: bigint;
  isPriority: boolean;
  remarks: string | null;
  productNote: string | null;
};

export type AdminOrderRecord = {
  id: bigint;
  legacyPhpId: string | null;
  orderNumber: string;
  orderDate: Date;
  grossAmountPaise: bigint;
  baseDiscountAmountPaise: bigint;
  additionalDiscountAmountPaise: bigint;
  couponDiscountAmountPaise: bigint;
  finalPayableAmountPaise: bigint;
  status: string;
  acceptanceStatus: string;
  fulfilmentStatus: string;
  cancelledAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  note: string | null;
  dealer: {
    id: bigint;
    businessName: string;
    dealerCode: string | null;
  };
  assignedStaff: {
    id: bigint;
    displayName: string;
  } | null;
  items?: AdminOrderItemRecord[];
};