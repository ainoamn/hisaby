"use client";

import { useEffect, useState } from "react";
import { BhdAppSwitcher, type BhdSwitcherUser } from "@/components/bhd/BhdAppSwitcher";
import {
  addBhdAccount,
  HISABY_WORKSPACE,
  releaseProductSession,
  signOutAllBhdAccounts,
  signOutThisBhdAccount,
  switchBhdAccount,
  type BhdRosterAccount,
  type IdentityAccount,
  type IdentitySession,
} from "@/lib/bhd/accounts";
import { DEFAULT_IDENTITY_ISSUER } from "@/lib/bhd/issuer";
import { useLocaleStore } from "@/store/locale";

function toSwitcherUser(item: IdentityAccount | BhdRosterAccount): BhdSwitcherUser {
  const id = "id" in item && item.id ? item.id : "sub" in item ? item.sub : undefined;
  const email = item.email || "";
  return {
    id,
    name: item.name || email || item.username || item.phone || "",
    email,
    username: item.username || null,
    phone: item.phone || null,
    picture: item.picture || null,
    providers: item.providers,
    googleLinked: "googleLinked" in item ? item.googleLinked : undefined,
    facebookLinked: "facebookLinked" in item ? item.facebookLinked : undefined,
    hasPassword: "hasPassword" in item ? item.hasPassword : undefined,
  };
}

export function BhdSessionMenu({
  user,
  platformAdmin = false,
}: {
  user: { name?: string | null; email?: string | null; avatar?: string | null };
  platformAdmin?: boolean;
}) {
  const locale = useLocaleStore((s) => s.locale);
  const [accounts, setAccounts] = useState<BhdSwitcherUser[]>([]);
  const [identityUser, setIdentityUser] = useState<BhdSwitcherUser | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLocal() {
      const response = await fetch("/api/auth/bhd/accounts", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) return [];
      const data = (await response.json()) as { accounts?: BhdRosterAccount[] };
      return Array.isArray(data.accounts) ? data.accounts.map(toSwitcherUser) : [];
    }

    async function load() {
      try {
        const response = await fetch(`${DEFAULT_IDENTITY_ISSUER}/api/auth/me`, {
          cache: "no-store",
          credentials: "include",
          mode: "cors",
        });
        if (response.ok) {
          const data = (await response.json()) as {
            user?: IdentityAccount | null;
            accounts?: IdentityAccount[];
          };
          const listed = Array.isArray(data.accounts) ? data.accounts.map(toSwitcherUser) : [];
          if (!cancelled && (data.user || listed.length)) {
            setIdentityUser(data.user ? toSwitcherUser(data.user) : null);
            setAccounts(listed);
            return;
          }
        }
      } catch {
        /* Identity CORS or network — use the product roster. */
      }
      try {
        const listed = await loadLocal();
        if (!cancelled) {
          setIdentityUser(null);
          setAccounts(listed);
        }
      } catch {
        if (!cancelled) setAccounts([]);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [user.email]);

  const email = (identityUser?.email || user.email || "").trim().toLowerCase();
  const current =
    accounts.find((item) => item.id && identityUser?.id && item.id === identityUser.id) ||
    accounts.find((item) => item.email && item.email.toLowerCase() === email);
  const switcherUser: BhdSwitcherUser = {
    id: identityUser?.id || current?.id,
    name: identityUser?.name || user.name || current?.name || "مستخدم",
    email: identityUser?.email || user.email || current?.email || "",
    username: identityUser?.username || current?.username || null,
    phone: identityUser?.phone || current?.phone || null,
    picture: identityUser?.picture || user.avatar || current?.picture || null,
    providers: identityUser?.providers || current?.providers,
    googleLinked: identityUser?.googleLinked || current?.googleLinked,
    facebookLinked: identityUser?.facebookLinked || current?.facebookLinked,
    hasPassword: identityUser?.hasPassword || current?.hasPassword,
  };

  const here = () =>
    typeof window === "undefined"
      ? HISABY_WORKSPACE
      : `${window.location.pathname}${window.location.search}`;

  function paintNext(): Promise<void> {
    return new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  }

  function applySession(session: IdentitySession) {
    if (session.user) setIdentityUser(toSwitcherUser(session.user));
    if (Array.isArray(session.accounts)) setAccounts(session.accounts.map(toSwitcherUser));
  }

  return (
    <BhdAppSwitcher
      user={switcherUser}
      accounts={accounts}
      platformAdmin={platformAdmin}
      locale={locale === "en" ? "en" : "ar"}
      onAddAccount={() => addBhdAccount(here())}
      onSwitchAccount={async (sub) => {
        const result = await switchBhdAccount(sub, switcherUser.id);
        if (result.kind === "handoff") return;
        if (result.session) applySession(result.session);
        if (result.kind !== "reenter") return;
        await paintNext();
        await releaseProductSession();
        window.location.assign(HISABY_WORKSPACE);
      }}
      onSignOut={async () => {
        const result = await signOutThisBhdAccount();
        if (result.kind !== "reenter") return;
        applySession(result.session);
        await paintNext();
        await releaseProductSession();
        window.location.assign(HISABY_WORKSPACE);
      }}
      onSignOutAll={() => signOutAllBhdAccounts()}
    />
  );
}
