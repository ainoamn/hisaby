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

export function isAllowedStartBack(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (!START_HOSTS.has(url.hostname)) return false;
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (!local && url.protocol !== "https:") return false;
    return url.pathname === "/api/auth/bhd/start";
  } catch {
    return false;
  }
}

function validSub(sub: string): boolean {
  return /^[A-Za-z0-9:_-]{6,128}$/.test(sub);
}

/** POST identity switch. Same-site Lax cookies are sent from *.bhd-om.com. */
export async function postIdentitySwitch(sub: string): Promise<void> {
  if (!validSub(sub)) return;
  try {
    await fetch(`${DEFAULT_IDENTITY_ISSUER}/api/auth/switch`, {
      method: "POST",
      credentials: "include",
      mode: "cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sub }),
    });
  } catch {
    // CORP hides the body. The browser may still store Set-Cookie.
  }
}

export async function switchBhdAccount(sub: string, returnTo: string): Promise<void> {
  const next = safeProductPath(returnTo);
  const back = `${window.location.origin}/api/auth/bhd/start?returnTo=${encodeURIComponent(next)}`;
  if (!isBhdSiteHost(window.location.hostname)) {
    const url = new URL("https://hisaby.bhd-om.com/bhd/switch");
    url.searchParams.set("sub", sub);
    url.searchParams.set("back", back);
    window.location.assign(url.toString());
    return;
  }
  await postIdentitySwitch(sub);
  window.location.assign(back);
}

export function addBhdAccount(returnTo: string): void {
  const next = safeProductPath(returnTo);
  window.location.assign(
    `/api/auth/bhd/start?add=1&returnTo=${encodeURIComponent(next)}`,
  );
}

export async function signOutThisBhdAccount(sub: string | undefined): Promise<void> {
  let remaining = true;
  try {
    const response = await fetch(`${DEFAULT_IDENTITY_ISSUER}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
      mode: "cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: false }),
    });
    if (response.ok) {
      const data = (await response.json()) as { user?: { id?: string } | null };
      remaining = Boolean(data.user?.id);
    }
  } catch {
    remaining = Boolean(sub);
  }
  if (!remaining || !sub) {
    window.location.assign("/api/auth/bhd/logout?all=1");
    return;
  }
  window.location.assign(
    `/api/auth/bhd/logout?sub=${encodeURIComponent(sub)}`,
  );
}

export function signOutAllBhdAccounts(): void {
  window.location.assign("/api/auth/bhd/logout?all=1");
}
