import { NextRequest, NextResponse } from "next/server";
import catalogueProducts from "../../../../public/data/omsons_products_from_excel_with_images.json";
import { prisma } from "@/server/db/prisma";
import { orderActorFromAuth } from "@/lib/orderScopeServer";
import { requireAuth } from "@/server/auth/session";
import {
  aggregatePendingProducts,
  buildPendingProductDrilldown,
  buildPendingProductFilterOptions,
  buildPendingProductLines,
  buildPendingProductsSummaryFromLines,
  filterPendingProductLines,
  filterPendingProducts,
  paginatePendingProducts,
  sortPendingProducts,
  type PendingDealerDirectoryRow,
  type PendingProductsItemRow,
  type PendingProductsOrderRow,
  type PendingProductsRole,
} from "@/lib/pendingProducts";
import { mapPostgresOrderDispatchRecords } from "@/lib/postgresOrderDispatch";

export const runtime = "nodejs";

type PendingProductsActor = { role: PendingProductsRole; actorId: string };

function safeText(value: unknown, max = 200) {
  return String(value ?? "").trim().slice(0, max);
}

function safeInteger(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
}

function parseSort(value: string) {
  if (value === "alphabetical" || value === "oldest_pending") return value;
  return "pending_desc";
}

async function loadOrders(actor: PendingProductsActor) {
  const where: any = {
    status: { notIn: ["CANCELLED", "DECLINED", "COMPLETED"] },
    acceptanceStatus: "ACCEPTED",
  };

  if (actor.role === "dealer") where.dealerId = BigInt(actor.actorId);
  if (actor.role === "staff") {
    const staffId = BigInt(actor.actorId);
    where.OR = [
      { assignedStaffId: staffId },
      { dealer: { staffAssignments: { some: { staffId, active: true } } } },
    ];
  }

  return prisma.order.findMany({
    where,
    include: {
      dealer: { select: { id: true, businessName: true } },
      assignedStaff: { select: { id: true, displayName: true } },
      items: { orderBy: { id: "asc" }, include: { dispatches: { orderBy: { createdAt: "asc" } } } },
    },
    orderBy: { orderDate: "asc" },
    take: 5000,
  });
}

function orderAlias(order: Awaited<ReturnType<typeof loadOrders>>[number]): PendingProductsOrderRow {
  return {
    order_id: order.legacyPhpId || order.id.toString(),
    orderId: order.legacyPhpId || order.id.toString(),
    order_date: order.orderDate.toISOString(),
    orderDate: order.orderDate.toISOString(),
    order_dealer: order.dealerId.toString(),
    orderdata_dealerid: order.dealerId.toString(),
    Dealer_Id: order.dealerId.toString(),
    Dealer_Name: order.dealer.businessName,
    accept_order: "1",
    del_status: "0",
    order_status: order.status,
    mtstatus: order.fulfilmentStatus,
    reason: order.cancellationReason ?? "",
    assignedstaff: order.assignedStaffId?.toString() ?? "",
    staffid: order.assignedStaffId?.toString() ?? "",
    staffname: order.assignedStaff?.displayName ?? "",
  };
}

function itemAliases(order: Awaited<ReturnType<typeof loadOrders>>[number]): PendingProductsItemRow[] {
  const orderId = order.legacyPhpId || order.id.toString();
  return order.items.map((item) => ({
    orderdata_id: item.legacyPhpOrderItemId || item.id.toString(),
    orderdata_orderid: orderId,
    orderdata_cat_no: item.catalogueNumberSnapshot,
    product_name: item.productNameSnapshot,
    product_discription: item.skuSnapshot ?? "",
    product_unit: "Units",
    orderdata_item_quantity: item.quantityPacks,
    readyquantity: item.dispatches.reduce((sum, dispatch) => sum + dispatch.quantity, 0),
    orderdata_status: item.dispatches.length > 0 ? "1" : "0",
    remark: item.remarks ?? "",
    remarks: item.remarks ?? "",
    packSize: item.packSize,
    totalPieces: item.totalPieces,
    quantityPacks: item.quantityPacks,
    category: item.categorySnapshot ?? "",
  }));
}

export async function GET(req: NextRequest) {
  try {
    const authActor = await requireAuth();
    const scopedActor = orderActorFromAuth(authActor);
    if (!scopedActor) {
      return NextResponse.json({ success: false, message: "Missing pending-products identity" }, { status: 401 });
    }

    const actor: PendingProductsActor = {
      role: scopedActor.role === "accountant" ? "admin" : scopedActor.role,
      actorId: scopedActor.actorId,
    };

    const search = safeText(req.nextUrl.searchParams.get("search"), 240);
    const category = safeText(req.nextUrl.searchParams.get("category"), 120);
    const sort = parseSort(safeText(req.nextUrl.searchParams.get("sort"), 40));
    const dealerId = safeText(req.nextUrl.searchParams.get("dealerId"), 120);
    const assignedStaffId = safeText(req.nextUrl.searchParams.get("assignedStaffId"), 120);
    const productKey = safeText(req.nextUrl.searchParams.get("productKey"), 260);
    const page = safeInteger(req.nextUrl.searchParams.get("page"), 1);
    const pageSize = safeInteger(req.nextUrl.searchParams.get("pageSize"), 20);

    const orders = await loadOrders(actor);
    const orderRows = orders.map(orderAlias);
    const orderItemsByOrderId: Record<string, PendingProductsItemRow[]> = {};
    const dispatchRecordsByOrderId: Record<string, ReturnType<typeof mapPostgresOrderDispatchRecords>> = {};
    const dealerDirectoryById: Record<string, PendingDealerDirectoryRow> = {};

    for (const order of orders) {
      const orderId = order.legacyPhpId || order.id.toString();
      orderItemsByOrderId[orderId] = itemAliases(order);
      dispatchRecordsByOrderId[orderId] = mapPostgresOrderDispatchRecords(order as any);
      dealerDirectoryById[order.dealerId.toString()] = {
        Dealer_Id: order.dealerId.toString(),
        Dealer_Name: order.dealer.businessName,
        assignedstaff: order.assignedStaffId?.toString() ?? "",
        staffname: order.assignedStaff?.displayName ?? "",
      };
    }

    const lines = buildPendingProductLines({
      orders: orderRows,
      orderItemsByOrderId,
      dispatchRecordsByOrderId,
      dealerDirectoryById,
      catalogueProducts: Array.isArray(catalogueProducts) ? catalogueProducts : [],
    });
    const scopedLines = filterPendingProductLines(lines, { dealerId, assignedStaffId });
    const summary = buildPendingProductsSummaryFromLines(scopedLines);
    const filters = buildPendingProductFilterOptions(scopedLines);

    if (productKey) {
      const detail = buildPendingProductDrilldown(scopedLines, productKey);
      if (!detail.aggregate) {
        return NextResponse.json({ success: false, message: "Pending product not found in your permitted scope." }, { status: 404 });
      }
      const paginatedOrders = paginatePendingProducts(detail.orders, page, pageSize);
      return NextResponse.json({ success: true, data: { product: detail.aggregate, orders: paginatedOrders.items, summary, filters, page: paginatedOrders.page, pageSize: paginatedOrders.pageSize, total: paginatedOrders.total, totalPages: paginatedOrders.totalPages, warnings: [] } }, { headers: { "Cache-Control": "no-store" } });
    }

    const aggregates = sortPendingProducts(filterPendingProducts(aggregatePendingProducts(scopedLines), { search, category }), sort);
    const paginatedProducts = paginatePendingProducts(aggregates, page, pageSize);
    return NextResponse.json({ success: true, data: { items: paginatedProducts.items, summary, filters, page: paginatedProducts.page, pageSize: paginatedProducts.pageSize, total: paginatedProducts.total, totalPages: paginatedProducts.totalPages, warnings: [] } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[GET /api/pending-products]", error);
    return NextResponse.json({ success: false, message: "Failed to load pending products." }, { status: 500 });
  }
}