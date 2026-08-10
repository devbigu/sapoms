import type { AdminListInput } from "@/server/admin/admin.types";

export type AdminProductListInput = AdminListInput;

export type AdminProductRecord = {
  id: bigint;
  productCode: string | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  active: boolean;
  category: { id: bigint; name: string; slug: string | null } | null;
  variants: AdminProductVariantRecord[];
};

export type AdminProductVariantRecord = {
  id: bigint;
  sku: string | null;
  catalogueNumber: string | null;
  unitName: string | null;
  packSize: number | null;
  unitPricePaise: bigint;
  packPricePaise: bigint;
  active: boolean;
};

export type ProductVariantWriteInput = {
  id?: string;
  sku?: string;
  catalogueNumber?: string;
  unitName?: string;
  packSize?: number;
  unitPricePaise?: bigint;
  packPricePaise?: bigint;
  active?: boolean;
};

export type ProductWriteInput = {
  productCode?: string;
  name: string;
  description?: string;
  imageUrl?: string;
  active?: boolean;
  variants: ProductVariantWriteInput[];
};
