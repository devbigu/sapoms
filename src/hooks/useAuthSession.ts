"use client";

import { useEffect, useState } from "react";
import { clearAuthStorage, normalizeRoleFromProfile, persistAuthenticatedSession, roleTypeForRole, type AuthSession, type StoredUser } from "@/lib/roleAccess";

type ResolvedAuth =
  | { loading: true; session: null }
  | { loading: false; session: AuthSession };

async function fetchCurrentSession(): Promise<AuthSession> {
  const res = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
  if (!res.ok) return { status: "unauthenticated", reason: "missing" };

  const json = await res.json();
  const data = json?.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { status: "unauthenticated", reason: "invalid" };
  }

  const user = data as StoredUser;
  const role = normalizeRoleFromProfile(user);
  if (!role) return { status: "unauthenticated", reason: "unsupported-role" };

  return {
    status: "authenticated",
    role,
    roletype: roleTypeForRole(role, user),
    user: { ...user, role },
  };
}

export function useAuthSession(): ResolvedAuth {
  const [state, setState] = useState<ResolvedAuth>({ loading: true, session: null });

  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      try {
        const session = await fetchCurrentSession();
        if (!cancelled) {
          if (session.status === "authenticated") persistAuthenticatedSession(localStorage, session.user, session.role);
          setState({ loading: false, session });
        }
      } catch {
        if (!cancelled) setState({ loading: false, session: { status: "unauthenticated", reason: "invalid" } });
      }
    };

    void resolve();

    const handleAuthChanged = () => void resolve();
    window.addEventListener("storage", handleAuthChanged);
    window.addEventListener("omsons-auth-changed", handleAuthChanged);

    return () => {
      cancelled = true;
      window.removeEventListener("storage", handleAuthChanged);
      window.removeEventListener("omsons-auth-changed", handleAuthChanged);
    };
  }, []);

  useEffect(() => {
    if (!state.loading && state.session.status !== "authenticated" && state.session.reason !== "missing") {
      clearAuthStorage(localStorage);
    }
  }, [state]);

  return state;
}
