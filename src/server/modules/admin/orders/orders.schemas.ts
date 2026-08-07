import { AdminRouteError } from "@/server/admin/admin-errors";
import { parseAdminPagination } from "@/server/admin/admin-pagination";
import type { AdminOrderListInput } from "./orders.types";

function optionalBigInt(value: string | null, label: string) {
  if (!value) return undefined;
  if (!/^\d+$/.test(value)) throw new AdminRouteError("INVALID_REQUEST", `Invalid ${label}`);
  return BigInt(value);
}

function optionalDate(value: string | null, label: string) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new AdminRouteError("INVALID_REQUEST", `Invalid ${label}`);
  return date;
}

export function parseAdminOrderListInput(searchParams: URLSearchParams): AdminOrderListInput {
  const base = parseAdminPagination(searchParams);
  const status = String(searchParams.get("status") ?? "").trim();
  if (status.length > 80) throw new AdminRouteError("INVALID_REQUEST", "status is too long");

  return {
    ...base,
    status,
    dealerId: optionalBigInt(searchParams.get("dealerId"), "dealerId"),
    staffId: optionalBigInt(searchParams.get("staffId"), "staffId"),
    dateFrom: optionalDate(searchParams.get("dateFrom"), "dateFrom"),
    dateTo: optionalDate(searchParams.get("dateTo"), "dateTo"),
  };
}