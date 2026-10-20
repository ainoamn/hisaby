import { BHD_APPS } from "@/lib/bhd/apps";
import { DEFAULT_IDENTITY_ISSUER } from "@/lib/bhd/issuer";

export function pageOrigin() {
  return typeof window === "undefined" ? "" : window.location.origin.replace(/\/$/, "");
}

/** Hisaby is the product. Only the identity host is the issuer. */
export function isIdentityOrigin(origin = pageOrigin()) {
  return origin.replace(/\/$/, "") === DEFAULT_IDENTITY_ISSUER;
}

export function identityApiUrl(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (isIdentityOrigin()) return normalized;
  return `${DEFAULT_IDENTITY_ISSUER}${normalized}`;
}

export function identityFetch(path: string, init?: RequestInit) {
  return fetch(identityApiUrl(path), {
    cache: "no-store",
    credentials: "include",
    ...init,
  });
}

export function currentReturnPath() {
  if (typeof window === "undefined") return "/dashboard";
  return `${window.location.pathname}${window.location.search || ""}` || "/dashboard";
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
    if (BHD_APPS.some((app) => app.origin.replace(/\/$/, "") === url.origin)) return url.toString();
    if (url.hostname === "bhd-om.com" || url.hostname.endsWith(".bhd-om.com")) return url.toString();
    if (url.hostname === "hisaby.pro" || url.hostname === "www.hisaby.pro") return url.toString();
  } catch {
    /* ignore */
  }
  return "";
}

/** Add-account is the only path that may open /login?add=1. */
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

/** Rebind this product to the active identity account. Never /login?add=1. */
export function applyAccountIsolation() {
  if (typeof window === "undefined") return;
  clearProductMemory();
  window.location.assign(productStartPath(currentReturnPath()));
}
