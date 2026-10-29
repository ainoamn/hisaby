"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth";
import { BhdPrivacyGate } from "@/components/bhd/BhdPrivacyGate";

export function BhdPrivacyGateDashboard() {
  const user = useAuthStore((s) => s.user);
  const [productSub, setProductSub] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void fetch("/api/auth/me", { cache: "no-store", credentials: "same-origin" })
      .then((r) => r.json())
      .then((data: { user?: { id?: string } | null }) => {
        if (!cancelled && data.user?.id) setProductSub(data.user.id);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (!user || !productSub) return null;
  return <BhdPrivacyGate productSub={productSub} productEmail={user.email} />;
}
