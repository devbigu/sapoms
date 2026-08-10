export type AuthRole = "ADMIN" | "NSM" | "ACCOUNTANT" | "RSM" | "STAFF" | "DEALER";
export type LegacyAuthSource = "PHP" | "MONGODB";

export type LegacyAuthenticatedActor = {
  source: LegacyAuthSource;
  legacyActorId: string;
  role: AuthRole;
  email?: string;
  displayName?: string;
  profile: Record<string, unknown>;
};

export interface AuthenticationProvider {
  authenticate(input: {
    email: string;
    password: string;
    legacyRoleType: string;
  }): Promise<LegacyAuthenticatedActor>;
}

export const LEGACY_ROLE_MAP = {
  "1": "STAFF",
  "2": "DEALER",
  "3": "ADMIN",
  "4": "ACCOUNTANT",
} as const;

export type LegacyRoleType = keyof typeof LEGACY_ROLE_MAP;

