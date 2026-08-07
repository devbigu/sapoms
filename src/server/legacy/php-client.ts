import "server-only";

import { getPhpBaseUrl } from "@/lib/phpBackend";

export interface LegacyPhpClient {
  get<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T>;
  postForm<T>(path: string, formData: FormData, query?: Record<string, string | number | undefined>): Promise<T>;
}

type RequestMethod = "GET" | "POST";

const DEFAULT_TIMEOUT_MS = 30000;

function normalizePath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

function timeoutMs() {
  const configured = Number(process.env.LEGACY_PHP_TIMEOUT_MS ?? process.env.LEDGER_FETCH_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS;
}

function appendQuery(url: URL, query?: Record<string, string | number | undefined>) {
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  });
}

async function parseJson<T>(response: Response, requestId: string): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();

  if (!contentType.toLowerCase().includes("json") && /^\s*</.test(text)) {
    throw new Error(`Legacy PHP returned HTML (${requestId})`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Legacy PHP returned malformed JSON (${requestId})`);
  }
}

async function request<T>(method: RequestMethod, routePath: string, body?: FormData, query?: Record<string, string | number | undefined>) {
  const requestId = crypto.randomUUID();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());

  try {
    const url = new URL(`${getPhpBaseUrl()}${normalizePath(routePath)}`);
    appendQuery(url, query);
    const response = await fetch(url, {
      method,
      body,
      signal: controller.signal,
      headers: { "x-omsons-request-id": requestId },
      cache: "no-store",
    });

    const data = await parseJson<T>(response, requestId);
    if (!response.ok) throw new Error(`Legacy PHP request failed with ${response.status} (${requestId})`);
    return data;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Legacy PHP request timed out (${requestId})`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export const legacyPhpClient: LegacyPhpClient = {
  get: (routePath, query) => request("GET", routePath, undefined, query),
  postForm: (routePath, formData, query) => request("POST", routePath, formData, query),
};
