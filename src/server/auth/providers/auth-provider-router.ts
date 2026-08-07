import "server-only";

import { LEGACY_ROLE_MAP, type AuthenticationProvider, type LegacyRoleType } from "./types";
import { mongoAccountantAuthenticationProvider } from "./mongo-accountant-auth.provider";
import { phpAuthenticationProvider } from "./php-auth.provider";

export function getAuthenticationProvider(legacyRoleType: string): AuthenticationProvider {
  const role = LEGACY_ROLE_MAP[legacyRoleType as LegacyRoleType];
  if (role === "ACCOUNTANT") return mongoAccountantAuthenticationProvider;
  return phpAuthenticationProvider;
}
