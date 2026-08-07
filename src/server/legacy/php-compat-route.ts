import { NextRequest, NextResponse } from "next/server";
import { getPhpBaseUrl } from "@/lib/phpBackend";

const TIMEOUT_MS = 30000;

type RouteContext = { params: Promise<{ path?: string[] }> };

function stripHopByHopHeaders(headers: Headers) {
  const nextHeaders = new Headers(headers);
  ["host", "connection", "content-length", "accept-encoding"].forEach((key) => nextHeaders.delete(key));
  nextHeaders.set("x-omsons-request-id", crypto.randomUUID());
  return nextHeaders;
}

async function proxy(request: NextRequest, context: RouteContext, prefix: "api" | "root") {
  const params = await context.params;
  const path = (params.path ?? []).map(encodeURIComponent).join("/");
  const legacyPrefix = prefix === "api" ? "/api" : "";
  const target = new URL(`${getPhpBaseUrl()}${legacyPrefix}/${path}`);
  request.nextUrl.searchParams.forEach((value, key) => target.searchParams.append(key, value));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const body = ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer();
    const legacyResponse = await fetch(target, {
      method: request.method,
      headers: stripHopByHopHeaders(request.headers),
      body,
      signal: controller.signal,
      cache: "no-store",
    });

    const responseHeaders = new Headers(legacyResponse.headers);
    responseHeaders.delete("content-encoding");
    responseHeaders.delete("content-length");
    return new NextResponse(legacyResponse.body, {
      status: legacyResponse.status,
      statusText: legacyResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`[${request.method} ${request.nextUrl.pathname}]`, error);
    return NextResponse.json({
      status: false,
      success: false,
      msg: "Legacy service unavailable",
      message: "Legacy service unavailable",
    }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}

export function makePhpCompatHandlers(prefix: "api" | "root") {
  return {
    GET: (request: NextRequest, context: RouteContext) => proxy(request, context, prefix),
    POST: (request: NextRequest, context: RouteContext) => proxy(request, context, prefix),
    PUT: (request: NextRequest, context: RouteContext) => proxy(request, context, prefix),
    PATCH: (request: NextRequest, context: RouteContext) => proxy(request, context, prefix),
    DELETE: (request: NextRequest, context: RouteContext) => proxy(request, context, prefix),
  };
}
