import { NextRequest, NextResponse } from "next/server";
import { applyUpstreamCookies, backendBase } from "@/lib/bhd-sso-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const REQUEST_SKIP = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

const RESPONSE_SKIP = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "keep-alive",
  "transfer-encoding",
  "set-cookie",
]);

function readCookie(header: string, name: string): string | null {
  for (const part of header.split(";")) {
    const row = part.trim();
    const eq = row.indexOf("=");
    if (eq <= 0) continue;
    if (row.slice(0, eq) !== name) continue;
    const value = row.slice(eq + 1);
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
}

async function proxy(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  const incoming = new URL(req.url);
  const target = `${backendBase()}/api/${path.map(encodeURIComponent).join("/")}${incoming.search}`;
  const origin = req.headers.get("origin") || incoming.origin;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (REQUEST_SKIP.has(key.toLowerCase())) return;
    headers.set(key, value);
  });
  headers.delete("origin");
  headers.set("x-forwarded-origin", origin);
  headers.set("x-forwarded-host", req.headers.get("host") || incoming.host);
  headers.set(
    "x-forwarded-proto",
    incoming.protocol.replace(":", "") || "https",
  );

  // Live Render CSRF (commit 1923f86) skips origin checks when Authorization
  // is present. The SPA session is cookie-only, so copy the access cookie.
  if (!headers.get("authorization")) {
    const access = readCookie(headers.get("cookie") || "", "bhd_access");
    if (access) headers.set("authorization", `Bearer ${access}`);
  }

  const method = req.method.toUpperCase();
  const upstream = await fetch(target, {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : await req.arrayBuffer(),
    redirect: "manual",
    cache: "no-store",
  });

  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    if (RESPONSE_SKIP.has(key.toLowerCase())) return;
    out.append(key, value);
  });
  out.set("cache-control", "no-store");

  const res = new NextResponse(method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    headers: out,
  });
  applyUpstreamCookies(res, upstream.headers);
  return res;
}

export const GET = proxy;
export const HEAD = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
