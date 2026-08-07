import "server-only";

import { legacyPhpClient } from "@/server/legacy/php-client";
import { sanitizeLegacyProfile } from "@/server/auth/sanitize-profile";
import { LEGACY_ROLE_MAP, type AuthenticationProvider, type AuthRole, type LegacyAuthenticatedActor } from "./types";

type LegacyPhpResponse = {
  status?: boolean | number | string;
  success?: boolean | number | string;
  msg?: string;
  message?: string;
  data?: unknown;
  [key: string]: unknown;
};

function isTruthyStatus(value: unknown) {
  return value === true || value === 1 || value === "1" || value === "true" || value === "success";
}

function firstString(profile: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = profile[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return undefined;
}

function actorIdForRole(role: AuthRole, profile: Record<string, unknown>) {
  if (role === "DEALER") return firstString(profile, ["Dealer_Id", "dealer_id", "id"]);
  if (role === "STAFF") return firstString(profile, ["staff_id", "Staff_Id", "id"]);
  return firstString(profile, ["admin_id", "Admin_Id", "staff_id", "id", "email"]);
}

function emailForRole(role: AuthRole, profile: Record<string, unknown>, fallback: string) {
  return firstString(profile, role === "DEALER" ? ["Dealer_Email", "email"] : ["staff_email", "email", "Admin_Email"]) ?? fallback;
}

function displayNameForRole(role: AuthRole, profile: Record<string, unknown>) {
  if (role === "DEALER") return firstString(profile, ["Dealer_Name", "name"]);
  if (role === "STAFF") return firstString(profile, ["staff_name", "name"]);
  return firstString(profile, ["name", "username", "staff_name", "Admin_Name"]);
}

function profileFromResponse(response: LegacyPhpResponse) {
  const data = response.data;
  if (data && typeof data === "object" && !Array.isArray(data)) return data as Record<string, unknown>;
  return Object.fromEntries(Object.entries(response).filter(([key]) => !["status", "success", "msg", "message"].includes(key)));
}

export class PhpAuthenticationProvider implements AuthenticationProvider {
  async authenticate(input: { email: string; password: string; legacyRoleType: string }): Promise<LegacyAuthenticatedActor> {
    const role = LEGACY_ROLE_MAP[input.legacyRoleType as keyof typeof LEGACY_ROLE_MAP];
    if (!role || role === "ACCOUNTANT") throw new Error("Unsupported PHP role");

    const formData = new FormData();
    formData.append("email", input.email);
    formData.append("password", input.password);
    formData.append("roletype", input.legacyRoleType);

    const response = await legacyPhpClient.postForm<LegacyPhpResponse>("/login/login_verify", formData);
    if (!isTruthyStatus(response.status) && !isTruthyStatus(response.success)) throw new Error("Invalid credentials");

    const profile = sanitizeLegacyProfile(profileFromResponse(response));
    const legacyActorId = actorIdForRole(role, profile);
    if (!legacyActorId) throw new Error("Missing actor ID");

    return {
      source: "PHP",
      legacyActorId,
      role,
      email: emailForRole(role, profile, input.email),
      displayName: displayNameForRole(role, profile),
      profile,
    };
  }
}

export const phpAuthenticationProvider = new PhpAuthenticationProvider();
