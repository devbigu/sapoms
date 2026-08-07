import { scanScopedOrders, type OrdersActor } from "@/lib/orderPagination";
import { parsePhpJsonResponse } from "@/lib/phpJson";

const BACKEND_URL = "/api/php-compat";
const UPSTREAM_PAGE_SIZE = 200;
const MAX_UPSTREAM_PAGES = 100;
const UPSTREAM_TIMEOUT_MS = 20_000;

export const ORDER_HEADER_SOURCES = new Set([
  "orderpegination",
  "orderhispegination",
  "orderpeginationnew",
  "staffOrderrPagination",
  "Orderstspegination",
]);

function text(value: unknown) {
  return String(value ?? "").trim();
}

function orderDedupeValues(order: Record<string, unknown>) {
  return [
    order.order_id,
    order.orderId,
    order.order_number,
    order.orderNumber,
    order.legacyPhpId,
  ].map(text).filter(Boolean);
}

async function loadPostgresRows(actor: OrdersActor) {
  try {
    const module = await import("@/lib/postgresOrders");
    return module.listPostgresOrderHeaders(actor);
  } catch {
    return [];
  }
}
function normalizedStatus(value: unknown) {
  return text(value).toLowerCase().replace(/[\s_-]/g, "");
}

export function isPendingOrderHeader(order: Record<string, unknown>) {
  const orderStatus = normalizedStatus(order.order_status ?? order.status);
  return orderStatus === "0" || orderStatus === "pending" || orderStatus === "awaiting";
}

export function resolveOrderHeaderSource(input: {
  source: string;
  actor: OrdersActor;
}) {
  if (input.source !== "orderpeginationnew") return input.source;
  if (input.actor.role === "staff") return "staffOrderrPagination";
  if (input.actor.role === "dealer") return "orderhispegination";
  return "orderpegination";
}

function upstreamActorIds(input: {
  source: string;
  actor: OrdersActor;
  assignedDealerIds: Array<string | number>;
}) {
  if (input.actor.role === "staff") {
    if (input.source === "orderhispegination") return input.assignedDealerIds.map(text).filter(Boolean);
    if (input.source === "staffOrderrPagination" || input.source === "Orderstspegination") return [input.actor.actorId];
    return [""];
  }
  return [input.actor.actorId];
}

export async function loadOrderHeaders(input: {
  source: string;
  actor: OrdersActor;
  assignedDealerIds?: Array<string | number>;
}) {
  if (!ORDER_HEADER_SOURCES.has(input.source)) throw new Error(`Unsupported order header source: ${input.source}`);
  const postgresRows = await loadPostgresRows(input.actor);
  const seen = new Set(postgresRows.flatMap(orderDedupeValues));
  const source = resolveOrderHeaderSource(input);
  const assignedDealerIds = input.assignedDealerIds ?? [];
  let upstreamHeaders = 0;
  const scan = await scanScopedOrders<Record<string, unknown>>({
    actor: input.actor,
    assignedDealerIds,
    upstreamActorIds: upstreamActorIds({ source, actor: input.actor, assignedDealerIds }),
    upstreamPageSize: UPSTREAM_PAGE_SIZE,
    maxUpstreamPages: MAX_UPSTREAM_PAGES,
    fetchPage: async (upstreamActorId, page, pageSize) => {
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize), search: "" });
      if (upstreamActorId) params.set("id", upstreamActorId);
      const response = await fetch(`${BACKEND_URL}/${source}?${params.toString()}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`${source} failed with ${response.status}`);
      const payload = await parsePhpJsonResponse<Record<string, unknown>>(response);
      const rows: Record<string, unknown>[] = Array.isArray(payload?.data)
        ? payload.data.filter((row: unknown): row is Record<string, unknown> => !!row && typeof row === "object")
        : [];
      upstreamHeaders += rows.length;
      return {
        rows,
        lastPage: Number(payload?.last_page ?? payload?.lastPage ?? 0),
        total: Number(payload?.count ?? payload?.total ?? payload?.recordsTotal ?? 0),
      };
    },
  });
  const rows = input.source === "orderpeginationnew"
    ? scan.rows.filter(isPendingOrderHeader)
    : scan.rows;
  const legacyRows = rows.filter((row) => !orderDedupeValues(row).some((value) => seen.has(value)));

  return {
    rows: [...postgresRows, ...legacyRows],
    truncated: scan.truncated,
    totalIsExact: scan.totalIsExact,
    diagnostics: { upstreamCalls: scan.pageCalls.length, upstreamHeaders },
  };
}
