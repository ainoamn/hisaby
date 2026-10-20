import { DEFAULT_IDENTITY_ISSUER } from "@/lib/bhd/issuer";

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
    return (await response.json()) as IdentitySession;
  } catch {
    return null;
  }
}

export type AccountSwitchResult =
  | { kind: "handoff" }
  | { kind: "stay"; session: IdentitySession | null }
  | { kind: "reenter"; session: IdentitySession };

/**
 * Switch on identity and return the JSON for the header.
 * A different sub re-enters the workspace once; the page is not reloaded first.
 */
export async function switchBhdAccount(
  sub: string,
  currentSub?: string,
): Promise<AccountSwitchResult> {
  if (!isBhdSiteHost(window.location.hostname)) {
    await releaseProductSession().catch(() => undefined);
    const url = new URL("https://hisaby.bhd-om.com/bhd/switch");
    url.searchParams.set("sub", sub);
    url.searchParams.set("back", `${window.location.origin}${HISABY_WORKSPACE}`);
    window.location.assign(url.toString());
    return { kind: "handoff" };
  }
  const session = await postIdentitySwitch(sub);
  const nextSub = session?.user?.id || session?.user?.sub;
  if (session?.user && nextSub && nextSub !== currentSub) {
    return { kind: "reenter", session };
  }
  return { kind: "stay", session };
}

export function addBhdAccount(returnTo: string): void {
  const next = safeProductPath(returnTo);
  window.location.assign(
    `/api/auth/bhd/start?add=1&returnTo=${encodeURIComponent(next)}`,
  );
}

export type SignOutResult =
  | { kind: "all" }
  | { kind: "reenter"; session: IdentitySession };

export async function signOutThisBhdAccount(): Promise<SignOutResult> {
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
        return { kind: "reenter", session };
      }
    }
  } catch {
    /* Identity unreachable — end every product session. */
  }
  window.location.assign("/api/auth/bhd/logout?all=1");
  return { kind: "all" };
}

export function signOutAllBhdAccounts(): void {
  window.location.assign("/api/auth/bhd/logout?all=1");
}
