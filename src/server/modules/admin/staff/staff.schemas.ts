import { z } from "zod";
import { AdminRouteError } from "@/server/admin/admin-errors";
import { parseAdminPagination } from "@/server/admin/admin-pagination";

export const parseAdminStaffListInput = parseAdminPagination;

const salesRegion = z.preprocess((value) => {
  if (value === undefined || value === null || String(value).trim() === "") return undefined;
  return String(value).trim().toUpperCase();
}, z.enum(["NORTH_1", "NORTH_2", "SOUTH_1", "SOUTH_2", "WEST_1", "WEST_2", "EAST", "ROM", "CENTRAL"]).optional());

const text = (max: number) => z.preprocess(
  (value) => (value === undefined || value === null ? undefined : String(value).trim()),
  z.string().max(max).optional(),
);

const requiredText = (max: number) => z.preprocess(
  (value) => (value === undefined || value === null ? "" : String(value).trim()),
  z.string().min(1).max(max),
);

const idText = z.preprocess((value) => {
  if (value === undefined || value === null || String(value).trim() === "") return undefined;
  return String(value).trim();
}, z.string().regex(/^\d+$/).optional());

const assignedStates = z.preprocess((value) => {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) return value.map((entry) => String(entry).trim()).filter(Boolean);
  const single = String(value).trim();
  return single ? [single] : [];
}, z.array(z.string().min(1).max(100)).max(40).optional());

function aliases(body: Record<string, unknown>) {
  return {
    name: body.name ?? body.staff_name ?? body.displayName,
    email: body.email ?? body.staff_email,
    password: body.password,
    role: body.role,
    designation: body.designation ?? body.staff_designation,
    location: body.location ?? body.staff_location,
    staffRoleType: body.staffRoleType ?? body.staff_roletype,
    salesRegion: body.salesRegion ?? body.region,
    parentRsmId: body.parentRsmId ?? body.parent_rsm_id ?? body.rsmId,
    parentAsmId: body.parentAsmId ?? body.parent_asm_id ?? body.asmId,
    assignedStates: body.assignedStates ?? body.assigned_states ?? body.states,
    status: body.status,
  };
}

const createRole = z.enum(["NSM", "RSM", "ASM", "STAFF"]);
const updateRole = z.enum(["STAFF", "RSM", "ASM", "NSM"]);

const baseStaffSchema = {
  name: requiredText(200),
  email: z.preprocess((value) => String(value ?? "").trim().toLowerCase(), z.string().email()),
  role: z.preprocess((value) => String(value ?? "STAFF").trim().toUpperCase(), createRole),
  designation: text(100),
  location: text(100),
  staffRoleType: text(30),
  salesRegion,
  parentRsmId: idText,
  parentAsmId: idText,
  assignedStates,
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).optional(),
};

function requireValidRoleRegion<T extends { role?: string; salesRegion?: string; staffRoleType?: string; parentRsmId?: string; parentAsmId?: string; assignedStates?: string[] }>(value: T) {
  if (value.role === "RSM" && !value.salesRegion) throw new AdminRouteError("INVALID_REQUEST", "RSM region is required", { code: "RSM_REGION_REQUIRED" });
  if (value.role && value.role !== "RSM") value.salesRegion = undefined;
  if (value.role === "STAFF" && value.staffRoleType !== "1" && value.staffRoleType !== "2") {
    throw new AdminRouteError("INVALID_REQUEST", "Staff role type is required", { code: "STAFF_ROLE_TYPE_REQUIRED" });
  }
  if (value.role === "ASM" && !value.parentRsmId) throw new AdminRouteError("INVALID_REQUEST", "ASM must have a valid RSM parent", { code: "ASM_RSM_REQUIRED" });
  if (value.role === "STAFF" && value.staffRoleType === "1" && !value.parentAsmId) throw new AdminRouteError("INVALID_REQUEST", "Executive must have a valid ASM parent", { code: "EXECUTIVE_ASM_REQUIRED" });
  if (value.role === "STAFF" && value.staffRoleType === "2" && !value.parentRsmId) throw new AdminRouteError("INVALID_REQUEST", "Staff must have a valid RSM parent", { code: "STAFF_RSM_REQUIRED" });
  if (value.role === "NSM") { value.staffRoleType = undefined; value.parentRsmId = undefined; value.parentAsmId = undefined; value.assignedStates = undefined; }
  if (value.role === "RSM") { value.staffRoleType = "RSM"; value.parentRsmId = undefined; value.parentAsmId = undefined; }
  if (value.role === "ASM") { value.staffRoleType = "ASM"; value.parentAsmId = undefined; }
  if (value.role === "STAFF" && value.staffRoleType === "1") value.parentRsmId = undefined;
  if (value.role === "STAFF" && value.staffRoleType === "2") { value.parentAsmId = undefined; value.assignedStates = undefined; }
  return value;
}

const createSchema = z.preprocess((value) => aliases((value && typeof value === "object" ? value : {}) as Record<string, unknown>), z.object({
  ...baseStaffSchema,
  password: z.string().min(10).max(200),
}).transform(requireValidRoleRegion));

const updateSchema = z.preprocess((value) => aliases((value && typeof value === "object" ? value : {}) as Record<string, unknown>), z.object({
  name: text(200),
  email: z.preprocess((value) => value === undefined || value === null || String(value).trim() === "" ? undefined : String(value).trim().toLowerCase(), z.string().email().optional()),
  role: z.preprocess((value) => value === undefined || value === null || String(value).trim() === "" ? undefined : String(value).trim().toUpperCase(), updateRole.optional()),
  designation: text(100),
  location: text(100),
  staffRoleType: text(30),
  salesRegion,
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).optional(),
}).refine((value) => Object.values(value).some((entry) => entry !== undefined), "At least one field is required").transform(requireValidRoleRegion));

function parseWith<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message || "Invalid request";
    throw new AdminRouteError("INVALID_REQUEST", first, { code: "INVALID_REQUEST" });
  }
  return parsed.data;
}

export function parseCreateAdminStaffInput(body: unknown) {
  return parseWith(createSchema, body);
}

export function parseUpdateAdminStaffInput(body: unknown) {
  return parseWith(updateSchema, body);
}
