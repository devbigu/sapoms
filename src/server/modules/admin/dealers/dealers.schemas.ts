import { z } from "zod";
import { AdminRouteError } from "@/server/admin/admin-errors";
import { parseAdminPagination } from "@/server/admin/admin-pagination";

const staffId = z.preprocess(
  (value) => (value === undefined || value === null || String(value).trim() === "" ? undefined : String(value).trim()),
  z.string().regex(/^\d+$/).optional(),
);

export function parseAdminDealerListInput(searchParams: URLSearchParams) {
  const base = parseAdminPagination(searchParams);
  return {
    ...base,
    staffId: staffId.parse(searchParams.get("staffId")),
  };
}

const text = (max: number) => z.preprocess(
  (value) => (value === undefined || value === null ? undefined : String(value).trim()),
  z.string().max(max).optional(),
);

const requiredText = (max: number) => z.preprocess(
  (value) => (value === undefined || value === null ? "" : String(value).trim()),
  z.string().min(1).max(max),
);

const optionalInteger = (max: number) => z.preprocess((value) => {
  if (value === undefined || value === null || String(value).trim() === "") return undefined;
  const parsed = Number(String(value).trim());
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}, z.number().int().min(0).max(max).optional());

const optionalDecimalPercent = z.preprocess((value) => {
  if (value === undefined || value === null || String(value).trim() === "") return undefined;
  return String(value).trim();
}, z.string().regex(/^\d+(?:\.\d{1,4})?$/).refine((value) => Number(value) >= 0 && Number(value) <= 100, "Discount must be between 0 and 100").optional());

const optionalBigIntString = z.preprocess((value) => {
  if (value === undefined || value === null || String(value).trim() === "") return undefined;
  return String(value).trim();
}, z.string().regex(/^\d+$/).optional());

const staffIds = z.preprocess((value) => {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") return value.split(",").map((entry) => entry.trim()).filter(Boolean);
  if (typeof value === "number" || typeof value === "bigint") return [String(value)];
  return value;
}, z.array(z.string().regex(/^\d+$/)).transform((values) => Array.from(new Set(values))));

const optionalStaffIds = z.preprocess((value) => {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") return value.split(",").map((entry) => entry.trim()).filter(Boolean);
  if (typeof value === "number" || typeof value === "bigint") return [String(value)];
  return value;
}, z.array(z.string().regex(/^\d+$/)).transform((values) => Array.from(new Set(values))).optional());

function aliases(body: Record<string, unknown>) {
  return {
    businessName: body.businessName ?? body.Dealer_Name ?? body.name,
    email: body.email ?? body.Dealer_Email,
    password: body.password ?? body.Dealer_Password,
    phone: body.phone ?? body.Dealer_Number ?? body.whatsapp,
    dealerCode: body.dealerCode ?? body.Dealer_Dealercode,
    address: body.address ?? body.Dealer_Address,
    city: body.city ?? body.Dealer_City,
    state: body.state,
    pincode: body.pincode ?? body.Dealer_Pincode,
    gstin: body.gstin ?? body.gst ?? body.gstNo,
    discountPercent: body.discountPercent ?? body.discount,
    creditDays: body.creditDays ?? body.creditdays,
    creditLimitPaise: body.creditLimitPaise ?? body.currentLimit,
    imageUrl: body.imageUrl,
    status: body.status,
    assignedStaffIds: body.assignedStaffIds ?? body.assignedstaff,
    rsmUserId: body.rsmUserId ?? body.rsmId ?? body.regionalManagerId,
  };
}

const createSchema = z.preprocess((value) => aliases((value && typeof value === "object" ? value : {}) as Record<string, unknown>), z.object({
  businessName: requiredText(200),
  email: z.preprocess((value) => String(value ?? "").trim().toLowerCase(), z.string().email()),
  password: z.string().min(10).max(200),
  phone: text(30),
  dealerCode: text(50),
  address: text(500),
  city: text(100),
  state: text(100),
  pincode: text(20),
  gstin: text(30),
  discountPercent: optionalDecimalPercent,
  creditDays: optionalInteger(3650),
  creditLimitPaise: optionalBigIntString,
  imageUrl: text(1000),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).optional(),
  assignedStaffIds: staffIds.default([]),
  rsmUserId: optionalBigIntString,
}));

const updateSchema = z.preprocess((value) => aliases((value && typeof value === "object" ? value : {}) as Record<string, unknown>), z.object({
  businessName: text(200),
  email: z.preprocess((value) => value === undefined || value === null || String(value).trim() === "" ? undefined : String(value).trim().toLowerCase(), z.string().email().optional()),
  phone: text(30),
  dealerCode: text(50),
  address: text(500),
  city: text(100),
  state: text(100),
  pincode: text(20),
  gstin: text(30),
  discountPercent: optionalDecimalPercent,
  creditDays: optionalInteger(3650),
  creditLimitPaise: optionalBigIntString,
  imageUrl: text(1000),
  assignedStaffIds: optionalStaffIds,
  rsmUserId: optionalBigIntString,
}).refine((value) => Object.values(value).some((entry) => entry !== undefined), "At least one field is required"));

const statusSchema = z.object({
  status: z.preprocess((value) => String(value ?? "").trim().toUpperCase(), z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"])),
  reason: text(500),
});

const staffReplaceSchema = z.object({
  staffIds,
  rsmUserId: optionalBigIntString,
});

function parseWith<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message || "Invalid request";
    throw new AdminRouteError("INVALID_REQUEST", first, { code: "INVALID_REQUEST" });
  }
  return parsed.data;
}

export function parseCreateAdminDealerInput(body: unknown) {
  return parseWith(createSchema, body);
}

export function parseUpdateAdminDealerInput(body: unknown) {
  return parseWith(updateSchema, body);
}

export function parseUpdateDealerStatusInput(body: unknown) {
  return parseWith(statusSchema, body);
}

export function parseReplaceDealerStaffInput(body: unknown) {
  return parseWith(staffReplaceSchema, body);
}


