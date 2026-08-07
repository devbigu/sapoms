const SENSITIVE_KEYS = new Set([
  "Dealer_Password",
  "staff_password",
  "ADMIN_PASSWORD",
  "password",
  "passwordHash",
]);

export function sanitizeLegacyProfile(profile: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(profile).filter(([key]) => !SENSITIVE_KEYS.has(key)),
  );
}

export function roleToClientRole(role: string) {
  return role.toLowerCase();
}

export function withClientRole(profile: Record<string, unknown>, role: string) {
  return { ...profile, role: roleToClientRole(role) };
}
