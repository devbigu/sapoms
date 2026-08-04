import { NextRequest, NextResponse } from "next/server";
import { fetchStaffAssignedDealerIds, parseOrderActor } from "@/lib/orderScopeServer";
import { isMongoDependencyError } from "@/lib/mongodb";
import { loadOrderHeaders } from "@/lib/orderHeaders";
import { listCancelledOrderOverlays, normalizeOverlayOrderId, toSafeOverlay } from "@/lib/orderOverlays";

export const runtime = "nodejs";

function positiveInt(value: string | null, fallback: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(1, Math.floor(parsed))) : fallback;
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function sourceForRole(role: "admin" | "staff" | "dealer" | "accountant") {
  if (role === "staff") return "staffOrderrPagination";
  if (role === "dealer") return "orderhispegination";
  return "orderpegination";
}

function legacyCancelledDate(row: Record<string, unknown>) {
  return text(row.order_date ?? row.orderdata_datetime ?? row.orderDate);
}

function legacyCancelledOverlay(row: Record<string, unknown>) {
  const orderId = normalizeOverlayOrderId(row.order_id ?? row.orderId);
  const reason = text(row.reason) || "Cancelled in legacy order system.";
  const cancelledAt = legacyCancelledDate(row);
  return {
    orderId,
    formattedOrderNumber: text(row.formattedOrderNumber),
    dealerId: text(row.order_dealer ?? row.orderdata_dealerid ?? row.Dealer_Id ?? row.dealerId),
    dealerName: text(row.Dealer_Name ?? row.dealerName),
    assignedStaffId: text(row.staffid ?? row.assignedstaff) || null,
    status: "cancelled",
    cancellation: {
      status: "cancelled",
      reason,
      cancelledBy: { id: "", role: "dealer", name: "Dealer" },
      cancelledAt,
    },
    edits: [],
    latestRevision: 0,
    originalOrderRef: row,
    source: "legacy-del-status",
    createdAt: cancelledAt,
    updatedAt: cancelledAt,
  };
}

function matchesSearch(row: ReturnType<typeof legacyCancelledOverlay>, search: string) {
  if (!search) return true;
  const query = search.toLowerCase();
  return [
    row.orderId,
    row.formattedOrderNumber,
    row.dealerName,
    row.cancellation.reason,
  ].some((value) => text(value).toLowerCase().includes(query));
}

export async function GET(req: NextRequest) {
  const actor = parseOrderActor({
    role: req.nextUrl.searchParams.get("role") || req.headers.get("x-omsons-actor-role"),
    actorId: req.nextUrl.searchParams.get("id") || req.nextUrl.searchParams.get("actor_id") || req.headers.get("x-omsons-actor-id"),
  });
  if (!actor) {
    return NextResponse.json({ success: false, message: "Missing cancelled-order identity." }, { status: 401 });
  }
  if (actor.role === "accountant") {
    return NextResponse.json({ success: false, message: "Cancelled orders are not available for this role." }, { status: 403 });
  }

  try {
    const assignedDealerIds = actor.role === "staff"
      ? await fetchStaffAssignedDealerIds(actor.actorId)
      : [];
    const page = positiveInt(req.nextUrl.searchParams.get("page"), 1, 100_000);
    const limit = positiveInt(req.nextUrl.searchParams.get("limit"), 10, 100);
    const search = req.nextUrl.searchParams.get("search") || "";
    let overlays: NonNullable<ReturnType<typeof toSafeOverlay>>[] = [];
    try {
      const overlayResult = await listCancelledOrderOverlays({
        role: actor.role,
        actorId: actor.actorId,
        assignedDealerIds,
        search,
        page: 1,
        limit: 5000,
      });
      overlays = overlayResult.rows.map(toSafeOverlay).filter(Boolean) as NonNullable<ReturnType<typeof toSafeOverlay>>[];
    } catch (error) {
      if (!isMongoDependencyError(error)) throw error;
      overlays = [];
    }
    const overlayIds = new Set(overlays.map((row) => text(row?.orderId)).filter(Boolean));

    const legacyLoaded = await loadOrderHeaders({
      source: sourceForRole(actor.role),
      actor,
      assignedDealerIds,
    });
    const legacyRows = legacyLoaded.rows
      .filter((row) => text(row.del_status) === "1")
      .map(legacyCancelledOverlay)
      .filter((row) => row.orderId && !overlayIds.has(row.orderId))
      .filter((row) => matchesSearch(row, search));

    const rows = [...overlays, ...legacyRows]
      .sort((a, b) => text(b?.cancellation?.cancelledAt ?? b?.updatedAt).localeCompare(text(a?.cancellation?.cancelledAt ?? a?.updatedAt)));
    const total = rows.length;
    const totalPages = Math.ceil(total / limit);
    const pagedRows = rows.slice((page - 1) * limit, page * limit);

    return NextResponse.json({
      success: true,
      data: pagedRows,
      count: total,
      total,
      page,
      limit,
      totalPages,
      last_page: totalPages,
    });
  } catch (error) {
    console.error("[GET /api/order-overlays/cancelled]", error);
    return NextResponse.json(
      {
        success: false,
        message: isMongoDependencyError(error)
          ? "Order overlay database is currently unavailable."
          : "Unable to load cancelled orders.",
      },
      { status: isMongoDependencyError(error) ? 503 : 500 }
    );
  }
}
