"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";
import {
  restoreQueryCache,
  startLiveSync,
  warmWorkspace,
  watchQueryCache,
} from "@/lib/live-workspace";
import { useAuthStore } from "@/store/auth";

/** Prefetch every workspace page and keep open data in step across users. */
export function LiveWorkspace() {
  const companyId = useAuthStore((s) => s.company?.id || s.user?.companyId || "");
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient = useQueryClient();
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const restoredFor = useRef("");

  useLayoutEffect(() => {
    if (!isAuthenticated || !companyId) return;
    if (restoredFor.current === companyId) return;
    if (restoredFor.current) queryClient.clear();
    restoredFor.current = companyId;
    restoreQueryCache(queryClient, companyId);
  }, [companyId, isAuthenticated, queryClient]);

  useEffect(() => {
    if (!isAuthenticated || !companyId) return;
    const stopSave = watchQueryCache(queryClient, companyId);
    const stopSync = startLiveSync(queryClient, companyId);
    const stopWarm = warmWorkspace(queryClient, routerRef.current, companyId);
    return () => {
      stopSave();
      stopSync();
      stopWarm();
    };
  }, [companyId, isAuthenticated, queryClient]);

  return null;
}
