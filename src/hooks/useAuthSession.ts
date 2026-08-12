"use client";

import { useEffect, useState } from "react";
import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { clearAuthStorage, normalizeRoleFromProfile, persistAuthenticatedSession, roleTypeForRole, type AuthSession, type StoredUser } from "@/lib/roleAccess";

type ResolvedAuth =
  | { loading: true; session: null }
  | { loading: false; session: AuthSession };

type RetriableAxiosConfig = InternalAxiosRequestConfig & { _sessionRefreshRetried?: boolean };

let refreshPromise: Promise<boolean> | null = null;
let axiosInterceptorInstalled = false;

async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

async function fetchWithSessionRefresh(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, { credentials: "include", cache: "no-store", ...init });
  if (response.status !== 401) return response;

  const refreshed = await refreshSession();
  if (!refreshed) return response;

  return fetch(input, { credentials: "include", cache: "no-store", ...init });
}

function installAxiosSessionRefresh() {
  if (axiosInterceptorInstalled) return;
  axiosInterceptorInstalled = true;

  axios.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const config = error.config as RetriableAxiosConfig | undefined;
      if (!config || error.response?.status !== 401 || config._sessionRefreshRetried) {
        return Promise.reject(error);
      }

      const url = String(config.url ?? "");
      if (url.includes("/api/auth/login") || url.includes("/api/auth/refresh")) {
        return Promise.reject(error);
      }

      const refreshed = await refreshSession();
      if (!refreshed) return Promise.reject(error);

      config._sessionRefreshRetried = true;
      config.withCredentials = true;
      return axios(config);
    },
  );
}

async function fetchCurrentSession(): Promise<AuthSession> {
  const res = await fetchWithSessionRefresh("/api/auth/me");
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
    installAxiosSessionRefresh();
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
