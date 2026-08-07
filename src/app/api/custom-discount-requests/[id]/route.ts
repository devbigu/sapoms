import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { requireAuth } from "@/server/auth/session";
import {
  actorFromRequestHeaders,
  assertDealerScope,
  customDiscountInclude,
  jsonValue,
  mapCustomDiscount,
  mapDraft,
  text,
  updateDraftApprovalState,
} from "@/lib/postgresDiscountDrafts";

export const runtime = "nodejs";

const DEFAULT_REJECTION_NOTE = "Please revise the discount percentage and resubmit.";

async function getActor(req: NextRequest) {
  return await requireAuth().catch(() => actorFromRequestHeaders(req.headers));
}

function jsonError(error: any, fallback: string) {
  const status = Number(error?.status) || (error?.message === "Unauthenticated" ? 401 : error?.message === "Forbidden" ? 403 : 500);
  return NextResponse.json({ success: false, message: status >= 500 ? fallback : error.message }, { status });
}

function statusValue(value: string) {
  const status = value.toUpperCase();
  if (["APPROVED", "REJECTED", "PENDING", "CANCELLED"].includes(status)) return status as "APPROVED" | "REJECTED" | "PENDING" | "CANCELLED";
  return null;
}

async function loadRequest(id: string) {
  if (!/^\d+$/.test(id)) return null;
  return prisma.customDiscountRequest.findUnique({ where: { id: BigInt(id) }, include: customDiscountInclude });
}

function rejectionRows(request: any) {
  const products = Array.isArray(request.orderSnapshot?.products) ? request.orderSnapshot.products : [];
  return products.slice(0, 100).map((product: any, index: number) => ({
    key: index + 1,
    productname: text(product.productName || product.catalogueNumber, 200),
    displayName: text(product.productName || product.catalogueNumber, 300),
    variantCode: text(product.catalogueNumber || product.sku, 160),
    producQuanity: Number(product.quantity ?? 1),
    price: Number(product.unitPrice ?? 0),
    packSize: Number(product.packSize ?? 1),
    isPriority: !!product.isPriority,
    productNote: text(product.productNote, 500),
  }));
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const actor = await getActor(req);
    const row = await loadRequest(id);
    if (!row) return NextResponse.json({ success: false, message: "Request not found" }, { status: 404 });
    if (actor?.role === "DEALER") {
      const actorId = actor.dealerId?.toString() || "";
      const ownerId = row.dealerId.toString();
      if (!actorId || actorId !== ownerId) return NextResponse.json({ success: false, message: "Request not found" }, { status: 404 });
    }
    assertDealerScope(actor, row.dealerId);
    return NextResponse.json({ success: true, data: mapCustomDiscount(row) });
  } catch (error) {
    console.error("[GET /api/custom-discount-requests/[id]]", error);
    return jsonError(error, "Failed to load custom discount request");
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const actor = await getActor(req);
    const body = await req.json();
    const existing = await loadRequest(id);
    if (!existing) return NextResponse.json({ success: false, message: "Request not found" }, { status: 404 });
    if (actor?.role === "DEALER") {
      const actorId = actor.dealerId?.toString() || "";
      const ownerId = existing.dealerId.toString();
      if (!actorId || actorId !== ownerId) return NextResponse.json({ success: false, message: "Request not found" }, { status: 404 });
    }
    assertDealerScope(actor, existing.dealerId);

    const rawStatus = text(body.status, 40);
    const nextStatus = rawStatus ? statusValue(rawStatus) : null;
    const orderId = text(body.orderId || body.order_id, 80);
    const hasOrderLink = !!orderId;
    const reviewUpdate = !!nextStatus;
    if (!reviewUpdate && typeof body.allowReorder !== "boolean" && !hasOrderLink) {
      return NextResponse.json({ success: false, message: "No supported update supplied" }, { status: 400 });
    }
    if (rawStatus && !nextStatus) return NextResponse.json({ success: false, message: "Invalid status" }, { status: 400 });
    if (reviewUpdate && actor?.role !== "ADMIN") throw Object.assign(new Error("Only Admin can review custom discounts"), { status: 403 });

    const data: any = { updatedAt: new Date() };
    if (reviewUpdate && nextStatus) {
      data.status = nextStatus;
      data.adminNote = text(body.adminNote ?? body.admin_note, 1500) || null;
      data.reviewedByUserId = actor?.userId && actor.userId > BigInt(0) ? actor.userId : null;
      data.reviewedAt = nextStatus === "PENDING" ? null : new Date();
      data.allowReorder = nextStatus === "APPROVED" ? true : nextStatus === "REJECTED" ? false : existing.allowReorder;
    }
    if (typeof body.allowReorder === "boolean") data.allowReorder = body.allowReorder;
    if (hasOrderLink) data.orderId = BigInt(orderId);

    const updated = await prisma.$transaction(async (tx) => {
      let rejectionDraftId: bigint | null = null;
      if (reviewUpdate && nextStatus === "REJECTED") {
        const draft = await tx.orderDraft.create({
          data: {
            dealerId: existing.dealerId,
            name: `Disapproved Request: ${new Date().toLocaleString("en-IN")}`,
            snapshot: jsonValue({
              rows: rejectionRows(existing),
              shipto: (existing.orderSnapshot as any)?.shipto ?? null,
              refno: (existing.orderSnapshot as any)?.refno ?? null,
              order_note: [text((existing.orderSnapshot as any)?.orderNote), "--- ADMIN REJECTION NOTE ---", data.adminNote || DEFAULT_REJECTION_NOTE, "Please update your cart and resubmit."].filter(Boolean).join("\n\n"),
              source: "custom_discount_rejection",
              source_request_id: existing.id.toString(),
            }),
            approvalState: jsonValue({ approvalRequestId: existing.id.toString(), status: "rejected", updatedAt: new Date().toISOString() }),
          },
        });
        rejectionDraftId = draft.id;
      }
      const row = await tx.customDiscountRequest.update({ where: { id: existing.id }, data, include: customDiscountInclude });
      if (row.orderDraftId) {
        await tx.orderDraft.updateMany({
          where: { id: row.orderDraftId, dealerId: row.dealerId },
          data: { approvalState: jsonValue({ approvalRequestId: row.id.toString(), status: String(row.status).toLowerCase(), updatedAt: new Date().toISOString() }) },
        });
      }
      return { row, rejectionDraftId };
    });

    const dto = mapCustomDiscount(updated.row) as any;
    if (updated.rejectionDraftId) dto.rejectionDraftId = updated.rejectionDraftId.toString();
    return NextResponse.json({ success: true, data: dto });
  } catch (error) {
    console.error("[PATCH /api/custom-discount-requests/[id]]", error);
    return jsonError(error, "Failed to update custom discount request");
  }
}