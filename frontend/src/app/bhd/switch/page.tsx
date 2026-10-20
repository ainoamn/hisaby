"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { isAllowedStartBack, isBhdSiteHost, postIdentitySwitch } from "@/lib/bhd/accounts";

function SwitchHandoff() {
  const params = useSearchParams();

  useEffect(() => {
    const sub = params.get("sub") || "";
    const back = params.get("back") || "";
    if (!isBhdSiteHost(window.location.hostname)) {
      const url = new URL("https://hisaby.bhd-om.com/bhd/switch");
      url.search = window.location.search;
      window.location.replace(url.toString());
      return;
    }
    void postIdentitySwitch(sub).finally(() => {
      if (isAllowedStartBack(back)) window.location.replace(back);
      else window.location.replace("/dashboard");
    });
  }, [params]);

  return (
    <p dir="rtl" style={{ fontFamily: "IBM Plex Sans Arabic, sans-serif", padding: 24 }}>
      جاري تبديل الحساب…
    </p>
  );
}

export default function BhdSwitchPage() {
  return (
    <Suspense fallback={null}>
      <SwitchHandoff />
    </Suspense>
  );
}
