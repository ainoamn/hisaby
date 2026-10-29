"use client";

import {
  applyAccountIsolation,
  clearAccountRebindLock,
  isAccountRebindPending,
  isIdentityOrigin,
  productStartPath,
} from "@/lib/identity/client";
import { loadBhdIdentity } from "@/lib/identity/bhd-browser";
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

export function BhdSilentSso() {
  useEffect(() => {
    const path = window.location.pathname;
    if (path === "/" || PUBLIC_PREFIX.some((item) => path.startsWith(item))) return;
    if (isIdentityOrigin() || isAccountRebindPending()) return;

    let cancelled = false;

    void loadBhdIdentity().then(async (identity) => {
      if (cancelled || !identity) return;
      try {
        const { ok, body } = await identity.me();
        if (cancelled || !ok || !body.user?.id) {
          clearAccountRebindLock();
          return;
        }

        const localResponse = await fetch("/api/auth/me", {
          cache: "no-store",
          credentials: "same-origin",
          signal: AbortSignal.timeout(8000),
        });
        const local = (await localResponse.json().catch(() => ({}))) as {
          user?: { id?: string } | null;
        };
        if (cancelled) return;

        if (local.user?.id && local.user.id === body.user.id) {
          clearAccountRebindLock();
          return;
        }

        const guardKey = `bhd-sso:${body.user.id}`;
        const last = Number(sessionStorage.getItem(guardKey) || "0");
        if (last && Date.now() - last < 15_000) return;
        sessionStorage.setItem(guardKey, String(Date.now()));

        if (!local.user?.id) {
          const here = `${window.location.pathname}${window.location.search || ""}` || "/dashboard";
          window.location.replace(identity.productStart(here) || productStartPath(here));
          return;
        }

        await applyAccountIsolation(body.token, { force: true });
      } catch {
        clearAccountRebindLock();
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
