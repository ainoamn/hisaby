import { getCachedCatalogApps } from "@/lib/bhd/catalog";
import { DEFAULT_IDENTITY_ISSUER } from "@/lib/bhd/issuer";
import { captureWindowToken, windowFetchHeaders } from "@/lib/identity/window-session";

export function pageOrigin() {
  return typeof window === "undefined" ? "" : window.location.origin.replace(/\/$/, "");
}

export function isIdentityOrigin(origin = pageOrigin()) {
  return origin.replace(/\/$/, "") === DEFAULT_IDENTITY_ISSUER;
}

export function identityApiUrl(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (isIdentityOrigin()) return normalized;
  return `${DEFAULT_IDENTITY_ISSUER}${normalized}`;
}

export async function identityFetch(path: string, init?: RequestInit) {
  const headers = windowFetchHeaders(init?.headers);
  const response = await fetch(identityApiUrl(path), {
    cache: "no-store",
    credentials: "include",
    ...init,
    headers,
  });
  const clone = response.clone();
  void clone
    .json()
    .then((data: { token?: unknown } | null) => {
      if (data && typeof data.token === "string") captureWindowToken(data.token);
    })
    .catch(() => undefined);
  return response;
}

export function currentReturnPath() {
  if (typeof window === "undefined") return "/dashboard";
  return `${window.location.pathname}${window.location.search || ""}` || "/dashboard";
}

export function cacheBustReturnPath(returnTo = "/dashboard") {
  const path = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/dashboard";
  try {
    const url = new URL(path, "https://bhd.local");
    url.searchParams.delete("_bhd");
    url.searchParams.set("_bhd", String(Date.now()));
    return `${url.pathname}${url.search}`;
  } catch {
    return path.includes("?") ? `${path}&_bhd=${Date.now()}` : `${path}?_bhd=${Date.now()}`;
  }
}

export function productStartPath(returnTo = "/dashboard") {
  const path = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/dashboard";
  return `/api/auth/bhd/start?returnTo=${encodeURIComponent(path)}`;
}

export function allowedBhdUrl(value: string) {
  try {
    const url = new URL(value);
    const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url.origin);
    if (url.protocol !== "https:" && !local) return "";
    if (url.origin === DEFAULT_IDENTITY_ISSUER) return url.toString();
    if (getCachedCatalogApps().some((app) => app.origin.replace(/\/$/, "") === url.origin))
      return url.toString();
    if (url.hostname === "bhd-om.com" || url.hostname.endsWith(".bhd-om.com")) return url.toString();
    if (url.hostname === "hisaby.pro" || url.hostname === "www.hisaby.pro") return url.toString();
  } catch {
    /* ignore */
  }
  return "";
}

export function addAccountUrl() {
  const here = typeof window === "undefined" ? "" : window.location.href;
  const next = `/auth/continue?to=${encodeURIComponent(here)}`;
  return `${identityApiUrl("/login")}?add=1&next=${encodeURIComponent(next)}`;
}

export function clearProductMemory() {
  try {
    localStorage.removeItem("bhd-auth");
  } catch {
    /* private mode */
  }
}

const REBIND_LOCK = "bhd_rebind_lock";

export function isAccountRebindPending() {
  if (typeof sessionStorage === "undefined") return false;
  const raw = sessionStorage.getItem(REBIND_LOCK);
  if (!raw) return false;
  const at = Number(raw);
  return Number.isFinite(at) && Date.now() - at < 15_000;
}

function markIsolationPending() {
  sessionStorage.setItem(REBIND_LOCK, String(Date.now()));
  try {
    document.documentElement.dataset.bhdSwitching = "1";
  } catch {
    /* ignore */
  }
}

function rebindWithWindowToken(token: string, returnTo: string) {
  clearProductMemory();
  const form = document.createElement("form");
  form.method = "POST";
  form.action = "/api/auth/bhd/rebind";
  form.style.display = "none";
  const tokenInput = document.createElement("input");
  tokenInput.name = "token";
  tokenInput.value = token;
  const returnInput = document.createElement("input");
  returnInput.name = "returnTo";
  returnInput.value = cacheBustReturnPath(returnTo);
  form.append(tokenInput, returnInput);
  document.body.appendChild(form);
  form.submit();
}

export async function switchWindowAccount(
  sub: string,
): Promise<{ ok: boolean; token?: string; userId?: string }> {
  if (!sub) return { ok: false };
  const response = await identityFetch("/api/auth/switch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sub }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    token?: string;
    user?: { id?: string } | null;
  };
  if (typeof body.token === "string") captureWindowToken(body.token);
  return {
    ok: response.ok,
    token: typeof body.token === "string" ? body.token : undefined,
    userId: body.user?.id,
  };
}

export async function applyAccountIsolation(token?: string | null, options?: { force?: boolean }) {
  if (typeof window === "undefined") return;
  if (!options?.force && isAccountRebindPending()) return;
  const here = currentReturnPath();
  if (isIdentityOrigin()) {
    window.location.reload();
    return;
  }
  markIsolationPending();
  const windowToken = token || sessionStorage.getItem("bhd_window_token") || "";

  if (windowToken) {
    rebindWithWindowToken(windowToken, here);
    return;
  }

  try {
    const response = await identityFetch("/api/auth/window-handoff", { method: "POST" });
    const data = (await response.json().catch(() => ({}))) as { ticket?: string };
    const start = new URL(productStartPath(cacheBustReturnPath(here)), window.location.origin).toString();
    if (response.ok && data.ticket) {
      const handoff = new URL("/auth/handoff", DEFAULT_IDENTITY_ISSUER);
      handoff.searchParams.set("ticket", data.ticket);
      handoff.searchParams.set("next", start);
      window.location.assign(handoff.toString());
      return;
    }
  } catch {
    /* fall through */
  }

  window.location.assign(
    `/api/auth/bhd/logout?continue=${encodeURIComponent(productStartPath(cacheBustReturnPath(here)))}`,
  );
}

export function clearAccountRebindLock() {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(REBIND_LOCK);
  try {
    delete document.documentElement.dataset.bhdSwitching;
  } catch {
    /* ignore */
  }
}
