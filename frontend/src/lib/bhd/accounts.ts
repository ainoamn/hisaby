import { DEFAULT_IDENTITY_ISSUER } from "@/lib/bhd/issuer";
import {
  addAccountUrl,
  applyAccountIsolation,
  clearProductMemory,
  currentReturnPath,
  paintPrivacyVeil,
  productStartPath,
  switchWindowAccount,
} from "@/lib/identity/client";

export type AuthProviderMark = "password" | "google" | "facebook" | "whatsapp";

export type BhdRosterAccount = {
  sub: string;
  email: string;
  name: string;
  picture: string | null;
  username?: string | null;
  phone?: string | null;
  providers?: AuthProviderMark[];
};

export type IdentityAccount = {
  id?: string;
  sub?: string;
  name?: string;
  email?: string;
  username?: string | null;
  phone?: string | null;
  picture?: string | null;
  providers?: AuthProviderMark[];
  googleLinked?: boolean;
  facebookLinked?: boolean;
  hasPassword?: boolean;
};

const START_HOSTS = new Set([
  "hisaby.bhd-om.com",
  "hisaby.pro",
  "www.hisaby.pro",
  "localhost",
  "127.0.0.1",
]);

export function safeProductPath(raw: string): string {
  const path = (raw || "/dashboard").split("#")[0] || "/dashboard";
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    return "/dashboard";
  }
  return path;
}

export function isBhdSiteHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "bhd-om.com" || host.endsWith(".bhd-om.com");
}

export type IdentitySession = {
  user?: IdentityAccount | null;
  accounts?: IdentityAccount[];
};

/** Hisaby client workspace. Middleware sends a missing session to start. */
export const HISABY_WORKSPACE = "/dashboard";

export function isAllowedProductBack(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (!START_HOSTS.has(url.hostname)) return false;
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (!local && url.protocol !== "https:") return false;
    const path = url.pathname || "/";
    if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return false;
    return true;
  } catch {
    return false;
  }
}

function validSub(sub: string): boolean {
  return /^[A-Za-z0-9:_-]{6,128}$/.test(sub);
}

/** Drop the product session so the next workspace load can start once if needed. */
export async function releaseProductSession(): Promise<void> {
  await fetch("/api/auth/bhd/release", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
  });
}

/** POST identity switch. Same-site Lax cookies are sent from *.bhd-om.com. */
export async function postIdentitySwitch(sub: string): Promise<IdentitySession | null> {
  if (!validSub(sub)) return null;
  try {
    const response = await fetch(`${DEFAULT_IDENTITY_ISSUER}/api/auth/switch`, {
      method: "POST",
      credentials: "include",
      mode: "cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sub }),
    });
    if (!response.ok) return null;
    try {
      return (await response.json()) as IdentitySession;
    } catch {
      return { user: { id: sub } };
    }
  } catch {
    return null;
  }
}

/**
 * Switch the active identity account, drop this product's old session,
 * then rebind via start. Never /login?add=1.
 */
export async function switchBhdAccount(sub: string): Promise<void> {
  const here = currentReturnPath();
  if (!isBhdSiteHost(window.location.hostname)) {
    clearProductMemory();
    await releaseProductSession().catch(() => undefined);
    const url = new URL("https://hisaby.bhd-om.com/bhd/switch");
    url.searchParams.set("sub", sub);
    url.searchParams.set("back", `${window.location.origin}${productStartPath(here)}`);
    window.location.assign(url.toString());
    return;
  }
  paintPrivacyVeil();
  const switched = await switchWindowAccount(sub);
  if (!switched.ok) return;
  clearProductMemory();
  await releaseProductSession().catch(() => undefined);
  await applyAccountIsolation(switched.token, { force: true, sub: switched.userId || sub });
}

export function addBhdAccount(): void {
  window.location.assign(addAccountUrl());
}

export async function signOutThisBhdAccount(): Promise<void> {
  try {
    const response = await fetch(`${DEFAULT_IDENTITY_ISSUER}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
      mode: "cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: false }),
    });
    if (response.ok) {
      const session = (await response.json()) as IdentitySession;
      if (session.user?.id || session.user?.sub) {
        clearProductMemory();
        await releaseProductSession().catch(() => undefined);
        await applyAccountIsolation(undefined, { force: true });
        return;
      }
    }
  } catch {
    /* Identity unreachable — end every product session. */
  }
  clearProductMemory();
  window.location.assign("/api/auth/bhd/logout?all=1");
}

export function signOutAllBhdAccounts(): void {
  window.location.assign("/api/auth/bhd/logout?all=1");
}
