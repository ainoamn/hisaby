"use client";

import { useEffect, useState } from "react";
import { BhdAppSwitcher, type BhdSwitcherUser } from "@/components/bhd/BhdAppSwitcher";
import {
  addBhdAccount,
  signOutAllBhdAccounts,
  signOutThisBhdAccount,
  switchBhdAccount,
  type BhdRosterAccount,
  type IdentityAccount,
} from "@/lib/bhd/accounts";
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
  const [productSub, setProductSub] = useState<string | null>(null);

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
        const me = await fetch("/api/auth/me", { cache: "no-store", credentials: "same-origin" });
        const meJson = (await me.json().catch(() => ({}))) as { user?: { id?: string } | null };
        if (!cancelled && meJson.user?.id) setProductSub(meJson.user.id);
      } catch {
        /* ignore */
      }
      try {
        const { identityFetch } = await import("@/lib/identity/client");
        const response = await identityFetch("/api/auth/me");
        if (response.ok) {
          const data = (await response.json()) as {
            user?: IdentityAccount | null;
            accounts?: IdentityAccount[];
          };
          const listed = Array.isArray(data.accounts) ? data.accounts.map(toSwitcherUser) : [];
          if (!cancelled && listed.length) {
            setAccounts(listed);
            return;
          }
        }
      } catch {
        /* Identity CORS or network — use the product roster. */
      }
      try {
        const listed = await loadLocal();
        if (!cancelled) setAccounts(listed);
      } catch {
        if (!cancelled) setAccounts([]);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [user.email]);

  const email = (user.email || "").trim().toLowerCase();
  const current =
    accounts.find((item) => item.id && productSub && item.id === productSub) ||
    accounts.find((item) => item.email && item.email.toLowerCase() === email);
  const switcherUser: BhdSwitcherUser = {
    id: productSub || current?.id,
    name: user.name || current?.name || "مستخدم",
    email: user.email || current?.email || "",
    username: current?.username || null,
    phone: current?.phone || null,
    picture: user.avatar || current?.picture || null,
    providers: current?.providers,
    googleLinked: current?.googleLinked,
    facebookLinked: current?.facebookLinked,
    hasPassword: current?.hasPassword,
  };

  return (
    <BhdAppSwitcher
      user={switcherUser}
      accounts={accounts}
      platformAdmin={platformAdmin}
      locale={locale === "en" ? "en" : "ar"}
      onAddAccount={() => addBhdAccount()}
      onSwitchAccount={(sub) => void switchBhdAccount(sub)}
      onSignOut={() => void signOutThisBhdAccount()}
      onSignOutAll={() => signOutAllBhdAccounts()}
    />
  );
}
