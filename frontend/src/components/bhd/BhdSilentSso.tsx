"use client";

import { identityFetch, productStartPath } from "@/lib/identity/client";
import { useEffect } from "react";

const PUBLIC_PREFIX = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/privacy",
  "/terms",
  "/security",
  "/pay",
  "/order",
  "/share",
  "/book",
  "/reserve",
  "/v/",
  "/dispute",
  "/oauth",
  "/api/",
  "/auth/",
  "/bhd/",
  "/callback",
  "/maintenance",
];

/**
 * A direct link follows the active identity account.
 * Mismatch rebinds through start once. No login form and no add=1.
 */
export function BhdSilentSso() {
  useEffect(() => {
    const path = window.location.pathname;
    if (path === "/" || PUBLIC_PREFIX.some((item) => path.startsWith(item))) return;

    let cancelled = false;
    const here = `${window.location.pathname}${window.location.search || ""}` || "/dashboard";
    const guardKey = `bhd-sso:${here}`;
    if (sessionStorage.getItem(guardKey) === "1") return;

    identityFetch("/api/auth/me", { signal: AbortSignal.timeout(8000) })
      .then((response) => (response.ok ? response.json() : null))
      .then(async (identity: { user?: { id?: string } | null } | null) => {
        if (cancelled || !identity?.user?.id) return;
        const localResponse = await fetch("/api/auth/me", {
          cache: "no-store",
          credentials: "same-origin",
          signal: AbortSignal.timeout(8000),
        });
        const local = (await localResponse.json().catch(() => ({}))) as {
          user?: { id?: string } | null;
        };
        if (cancelled) return;
        if (local.user?.id && local.user.id === identity.user.id) return;
        try {
          localStorage.removeItem("bhd-auth");
        } catch {
          /* ignore */
        }
        sessionStorage.setItem(guardKey, "1");
        window.location.replace(productStartPath(here));
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
