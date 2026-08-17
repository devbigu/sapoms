import { NextRequest, NextResponse } from "next/server";
import { Prisma, OrderDiscountType, WalletTransactionType } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { requireAuth } from "@/server/auth/session";
import { applyWalletChange } from "@/lib/postgresWallet";

export const runtime = "nodejs";

class OrderError extends Error {
  constructor(message: string, public status = 400, public code = "order_error") { super(message); }
}

type ParsedItem = {
  productname: string;
  productName: string;
  catNo: string;
  quantityPacks: number;
  packSize: number;
  totalPieces: number;
  unitPricePaise: bigint;
  listPriceTotalPaise: bigint;
  discountPercent: number;
  discountAmountPaise: bigint;
  finalAmountPaise: bigint;
  remarks: string;
  productNote: string;
  priority: boolean;
  variantId?: bigint;
  productId?: bigint;
};

function text(value: unknown, max = 1000) { return String(value ?? "").trim().slice(0, max); }
function optionalBigInt(value: unknown) { const raw = text(value, 40); return /^\d+$/.test(raw) ? BigInt(raw) : undefined; }
function num(value: unknown) { const n = Number(String(value ?? "").replace(/,/g, "").trim()); return Number.isFinite(n) ? n : 0; }
function paise(value: unknown) { return BigInt(Math.round(num(value) * 100)); }
function fromPaise(value: bigint) { return Number(value) / 100; }
function clampPercent(value: unknown) { return Math.min(100, Math.max(0, num(value))); }
function jsonBigInt(_key: string, value: unknown) { return typeof value === "bigint" ? value.toString() : value; }

function logOrderFailure(stage: string, error: unknown) {
  const record = error && typeof error === "object" ? error as Record<string, unknown> : {};
  console.error("[POST /api/dealer-order] failed", {
    stage,
    prismaCode: typeof record.code === "string" ? record.code : undefined,
    model: typeof record.modelName === "string" ? record.modelName : undefined,
    operation: typeof record.clientMethod === "string" ? record.clientMethod : undefined,
    message: error instanceof Error ? error.message : String(error),
  });
}

function parseProductOrder(form: FormData): Array<Record<string, unknown>> {
  const raw = text(form.get("productorder"), 2_000_000);
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new OrderError("Order products are malformed.", 422, "invalid_products"); }
  if (!Array.isArray(parsed) || parsed.length === 0) throw new OrderError("At least one order product is required.", 422, "invalid_products");
  return parsed.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
}

async function nextOrderNumber(tx: Prisma.TransactionClient) {
  const year = new Date().getFullYear();
  const sequence = await tx.orderSequence.upsert({
    where: { year },
    create: { year, lastValue: BigInt(1) },
    update: { lastValue: { increment: BigInt(1) } },
  });
  const yearRange = `${String(year).slice(-2)}-${String(year + 1).slice(-2)}`;
  return `OM/${yearRange}/DMS-${sequence.lastValue.toString().padStart(3, "0")}`;
}

function parseItems(rows: Array<Record<string, unknown>>): ParsedItem[] {
  const items: ParsedItem[] = [];
  for (const row of rows) {
    const catNo = text(row.catNo ?? row.variantCode ?? row.productname, 160);
    const productName = text(row.productName ?? row.productname, 300);
    const quantityPacks = Math.trunc(num(row.quantityPacks) || (num(row.producQuanity) / Math.max(1, num(row.packSize) || 1)));
    const submittedPackSize = Math.trunc(num(row.packSize) || 1);
    if (!catNo || !productName || quantityPacks <= 0 || submittedPackSize <= 0) throw new OrderError("Order product quantity is invalid.", 422, "invalid_quantity");

    const packSize = submittedPackSize || 1;
    const totalPieces = quantityPacks * packSize;
    const unitPricePaise = paise(row.unitPrice ?? row.price);
    const submittedListPricePaise = paise(row.listPriceTotal ?? row.grossAmount ?? row.subtotal);
    const listPriceTotalPaise = submittedListPricePaise > BigInt(0) ? submittedListPricePaise : unitPricePaise * BigInt(totalPieces);
    const discountPercent = clampPercent(row.discountPercent ?? row.totalDiscountPercent);
    const submittedDiscountPaise = paise(row.discount ?? row.discountAmount);
    const discountAmountPaise = submittedDiscountPaise > BigInt(0) ? submittedDiscountPaise : BigInt(Math.round(Number(listPriceTotalPaise) * (discountPercent / 100)));
    const submittedFinalPaise = paise(row.afterDiscountPrice ?? row.finalAmount);
    const calculatedFinalPaise = listPriceTotalPaise > discountAmountPaise ? listPriceTotalPaise - discountAmountPaise : BigInt(0);
    const finalAmountPaise = submittedFinalPaise > BigInt(0) ? submittedFinalPaise : calculatedFinalPaise;

    items.push({
      productname: text(row.productname ?? productName, 300),
      productName,
      catNo,
      quantityPacks,
      packSize,
      totalPieces,
      unitPricePaise,
      listPriceTotalPaise,
      discountPercent,
      discountAmountPaise,
      finalAmountPaise,
      remarks: text(row.remarks, 1500),
      productNote: text(row.productNote ?? row.product_note ?? row.note, 1500),
      priority: row.isPriority === true || text(row.priority, 20) === "1" || text(row.isPriority, 20).toLowerCase() === "true",
      productId: optionalBigInt(row.productId),
      variantId: optionalBigInt(row.variantId),
    });
  }
  return items;
}

async function validateCustomDiscounts(tx: Prisma.TransactionClient, form: FormData, dealerId: bigint) {
  const ids = text(form.get("customDiscountRequestId"), 2000).split(",").map((id) => id.trim()).filter(Boolean);
  if (text(form.get("additionalDiscountType"), 40).toLowerCase() !== "custom" && ids.length === 0) return [];
  if (ids.length === 0) throw new OrderError("Approved custom-discount reference is required.", 409, "custom_discount_not_approved");
  const bigIds = ids.map((id) => BigInt(id));
  const approved = await tx.customDiscountRequest.findMany({ where: { id: { in: bigIds }, dealerId, status: "APPROVED", orderId: null } });
  if (approved.length !== bigIds.length) throw new OrderError("Custom discount is not approved for this order.", 409, "custom_discount_not_approved");
  return approved;
}

export async function POST(request: NextRequest) {
  let failureStage = "request";
  try {
    failureStage = "auth";
    const actor = await requireAuth();
    if (actor.role !== "DEALER" || !actor.dealerId) return NextResponse.json({ success: false, message: "Only dealers can create orders." }, { status: 403 });

    failureStage = "form parse";
    const form = await request.formData();
    if (form.has("exelefile")) return NextResponse.json({ success: false, message: "Excel order import has not been migrated to PostgreSQL yet." }, { status: 422 });
    const idempotencyKey = text(request.headers.get("idempotency-key"), 240) || null;
    const submittedDraftId = text(form.get("orderDraftId") ?? form.get("order_draft_id") ?? form.get("draftId"), 80);
    const fromCart = text(form.get("fromCart") ?? form.get("from_cart"), 20).toLowerCase() === "true";

    const result = await prisma.$transaction(async (tx) => {
      failureStage = "idempotency lookup";
      if (idempotencyKey) {
        const existing = await tx.order.findUnique({ where: { idempotencyKey } });
        if (existing) return { order: existing, duplicate: true, wallet: null as null | { used: boolean; balanceAfter: number } };
      }

      failureStage = "dealer lookup";
      const dealer = await tx.dealerProfile.findUnique({ where: { id: actor.dealerId }, include: { user: true, staffAssignments: { where: { active: true }, take: 1 } } });
      if (!dealer || dealer.deletedAt || dealer.user.status !== "ACTIVE") throw new OrderError("This dealer account is inactive.", 403, "inactive_dealer");

      failureStage = "product parse";
      const rows = parseProductOrder(form);
      const items = parseItems(rows);
      const grossAmountPaise = items.reduce((sum, item) => sum + item.listPriceTotalPaise, BigInt(0));
      const baseDiscountPercent = clampPercent(form.get("baseDiscountPercent") ?? form.get("allocatedDiscountPercent") ?? dealer.discountPercent ?? 0);
      const baseDiscountAmountPaise = BigInt(Math.round(Number(grossAmountPaise) * (baseDiscountPercent / 100)));
      const postBaseAmountPaise = grossAmountPaise - baseDiscountAmountPaise;
      const additionalTypeText = text(form.get("additionalDiscountType"), 40).toLowerCase();
      const additionalDiscountType = additionalTypeText === "custom" ? OrderDiscountType.CUSTOM : additionalTypeText === "slab" ? OrderDiscountType.SLAB : OrderDiscountType.NONE;
      const slabDiscountPercent = additionalDiscountType === OrderDiscountType.SLAB ? clampPercent(form.get("slabDiscountPercent")) : 0;
      const slabDiscountAmountPaise = additionalDiscountType === OrderDiscountType.SLAB ? BigInt(Math.round(Number(postBaseAmountPaise) * (slabDiscountPercent / 100))) : BigInt(0);
      let customDiscountAmountPaise = additionalDiscountType === OrderDiscountType.CUSTOM ? paise(form.get("customDiscountAmount") ?? form.get("additionalDiscountAmount")) : BigInt(0);
      let additionalDiscountAmountPaise = additionalDiscountType === OrderDiscountType.CUSTOM ? customDiscountAmountPaise : slabDiscountAmountPaise;
      const couponDiscountPercent = clampPercent(form.get("couponDiscountPercent"));
      let couponDiscountAmountPaise = BigInt(Math.round(Number(postBaseAmountPaise - additionalDiscountAmountPaise) * (couponDiscountPercent / 100)));
      let totalDiscountAmountPaise = baseDiscountAmountPaise + additionalDiscountAmountPaise + couponDiscountAmountPaise;
      let finalPayableAmountPaise = grossAmountPaise > totalDiscountAmountPaise ? grossAmountPaise - totalDiscountAmountPaise : BigInt(0);
      let totalDiscountPercent = grossAmountPaise > BigInt(0) ? Number(totalDiscountAmountPaise) * 100 / Number(grossAmountPaise) : 0;

      failureStage = "discount validation";
      const customRequests = await validateCustomDiscounts(tx, form, dealer.id);
      if (additionalDiscountType === OrderDiscountType.CUSTOM) {
        customDiscountAmountPaise = customRequests.reduce((sum, request) => sum + (request.requestedDiscountAmountPaise ?? BigInt(0)), BigInt(0));
        additionalDiscountAmountPaise = customDiscountAmountPaise;
        couponDiscountAmountPaise = BigInt(Math.round(Number(postBaseAmountPaise - additionalDiscountAmountPaise) * (couponDiscountPercent / 100)));
        totalDiscountAmountPaise = baseDiscountAmountPaise + additionalDiscountAmountPaise + couponDiscountAmountPaise;
        finalPayableAmountPaise = grossAmountPaise > totalDiscountAmountPaise ? grossAmountPaise - totalDiscountAmountPaise : BigInt(0);
        totalDiscountPercent = grossAmountPaise > BigInt(0) ? Number(totalDiscountAmountPaise) * 100 / Number(grossAmountPaise) : 0;
      }
      failureStage = "wallet lookup";
      const wallet = await tx.dealerWallet.findUnique({ where: { dealerId: dealer.id } });
      if (wallet?.status === "ACTIVE") {
        const available = wallet.balancePaise - wallet.reservedPaise;
        if (available < finalPayableAmountPaise) throw new OrderError(`Insufficient wallet balance. Available: ₹${fromPaise(available).toLocaleString("en-IN")}. Required: ₹${fromPaise(finalPayableAmountPaise).toLocaleString("en-IN")}.`, 409, "insufficient_balance");
      }

      failureStage = "order sequence";
      const orderNumber = await nextOrderNumber(tx);
      const orderData: any = {
        orderNumber,
        dealerId: dealer.id,
        assignedStaffId: dealer.staffAssignments[0]?.staffId ?? null,
        createdByUserId: actor.userId,
        idempotencyKey,
        shipTo: text(form.get("Dealer_shipto") ?? form.get("shipTo"), 1000),
        refNo: text(form.get("refno") ?? form.get("refNo"), 160),
        note: text(form.get("note") ?? form.get("order_note") ?? form.get("Dealer_note"), 1500),
        grossAmountPaise,
        allocatedDiscountPercent: new Prisma.Decimal(baseDiscountPercent),
        couponDiscountPercent: new Prisma.Decimal(couponDiscountPercent),
        couponCode: text(form.get("coupon_code"), 80) || null,
        baseDiscountPercent: new Prisma.Decimal(baseDiscountPercent),
        baseDiscountAmountPaise,
        postBaseAmountPaise,
        additionalDiscountType,
        additionalDiscountAmountPaise,
        customDiscountAmountPaise,
        slabDiscountPercent: new Prisma.Decimal(slabDiscountPercent),
        slabDiscountAmountPaise,
        totalDiscountPercent: new Prisma.Decimal(totalDiscountPercent),
        totalDiscountAmountPaise,
        finalPayableAmountPaise,
        status: "AWAITING_ACCEPTANCE",
        acceptanceStatus: "AWAITING",
        fulfilmentStatus: "PENDING",
        items: { create: items.map((item) => ({
          productId: item.productId,
          productVariantId: item.variantId,
          productNameSnapshot: item.productName,
          catalogueNumberSnapshot: item.catNo,
          skuSnapshot: item.catNo,
          quantityPacks: item.quantityPacks,
          packSize: item.packSize,
          totalPieces: item.totalPieces,
          unitPricePaise: item.unitPricePaise,
          listPriceTotalPaise: item.listPriceTotalPaise,
          discountPercent: new Prisma.Decimal(item.discountPercent),
          discountAmountPaise: item.discountAmountPaise,
          finalAmountPaise: item.finalAmountPaise,
          isPriority: item.priority,
          remarks: item.remarks || null,
          productNote: item.productNote || null,
        })) },
      };
      failureStage = "Order create";
      const order = await tx.order.create({ data: orderData });

      failureStage = "discount link";
      if (customRequests.length) await tx.customDiscountRequest.updateMany({ where: { id: { in: customRequests.map((r) => r.id) } }, data: { orderId: order.id } });
      if (submittedDraftId && /^\d+$/.test(submittedDraftId)) {
        failureStage = "draft conversion";
        await tx.orderDraft.updateMany({ where: { id: BigInt(submittedDraftId), dealerId: dealer.id }, data: { status: "CONVERTED", orderId: order.id } });
      }
      if (fromCart) {
        failureStage = "draft cart clear";
        await tx.draftCart.deleteMany({ where: { dealerId: dealer.id } });
      }
      let walletPayload: null | { used: boolean; transactionId: string; amountConsumed: number; balanceAfter: number } = null;
      if (wallet?.status === "ACTIVE") {
        failureStage = "wallet debit";
        const walletDebit = await applyWalletChange(tx, dealer.id, WalletTransactionType.ORDER_DEBIT, fromPaise(finalPayableAmountPaise), {
          orderId: order.id,
          idempotencyKey: idempotencyKey ? `${idempotencyKey}:wallet` : null,
          reference: order.orderNumber,
          note: "Order wallet debit",
          metadata: { orderNumber: order.orderNumber },
          actor: { userId: actor.userId, role: actor.role, displayName: actor.displayName },
        });
        walletPayload = { used: true, transactionId: walletDebit.transaction.id, amountConsumed: walletDebit.transaction.amount, balanceAfter: walletDebit.transaction.balanceAfter };
      }
      failureStage = "audit log";
      await tx.authAuditLog.create({ data: { sessionId: actor.sessionId, role: actor.role, eventType: "ORDER_CREATED", metadata: { orderId: order.id.toString(), orderNumber } } });
      return { order, duplicate: false, wallet: walletPayload };
    });

    return NextResponse.json(JSON.parse(JSON.stringify({
      status: true,
      success: true,
      duplicate: result.duplicate,
      msg: "Order placed successfully",
      message: "Order placed successfully",
      orderId: result.order.id,
      order_id: result.order.id,
      orderNumber: result.order.orderNumber,
      wallet: result.wallet,
    }, jsonBigInt)));
  } catch (error: any) {
    logOrderFailure(failureStage, error);
    const status = Number(error?.status) || 500;
    return NextResponse.json({ success: false, status: false, code: error?.code || "order_failed", message: status >= 500 ? "Unable to submit order." : error.message }, { status });
  }
}




