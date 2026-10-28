"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { CommandPalette } from "@/components/dashboard/command-palette";
import { MaintenanceGate } from "@/components/layout/maintenance-gate";
import { Require2faBanner } from "@/components/auth/require-2fa-banner";
import { MobileAppSwitcher } from "@/components/shared/mobile-app-switcher";
import { useUIStore } from "@/store/ui";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";
import { useEffect, useState, type CSSProperties } from "react";
import { usePathname, useRouter } from "next/navigation";
import api from "@/lib/api";
import {
  canAccessModule,
  moduleForDashboardPath,
} from "@/lib/module-permissions";
import { homePathForUser } from "@/lib/user-home";
import { wakeApi } from "@/lib/wake-api";

const BOOT_ESCAPE_KEY = "hisaby-boot-escape";

function escapeAlreadyUsed() {
  try {
    return sessionStorage.getItem(BOOT_ESCAPE_KEY) === "1";
  } catch {
    return false;
  }
}

function markEscapeUsed() {
  try {
    sessionStorage.setItem(BOOT_ESCAPE_KEY, "1");
  } catch {
    /* private mode */
  }
}

function clearEscape() {
  try {
    sessionStorage.removeItem(BOOT_ESCAPE_KEY);
  } catch {
    /* private mode */
  }
}

function startUrl() {
  const next = `${window.location.pathname}${window.location.search || ""}` || "/dashboard";
  return `/api/auth/bhd/start?returnTo=${encodeURIComponent(next)}`;
}

const bootScreenStyle: CSSProperties = {
  minHeight: "100vh",
  width: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 16,
  padding: 24,
  textAlign: "center",
  boxSizing: "border-box",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { sidebarCollapsed, sidebarOpen, setSidebarOpen } = useUIStore();
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [hydrated, setHydrated] = useState(false);
  const [bootTimedOut, setBootTimedOut] = useState(false);
  const [bootRetry, setBootRetry] = useState(0);

  useEffect(() => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      useAuthStore.getState().setLoading(false);
      setHydrated(true);
    };
    if (useAuthStore.persist.hasHydrated()) finish();
    const unsub = useAuthStore.persist.onFinishHydration(() => finish());
    const backup = window.setTimeout(finish, 1000);
    wakeApi();
    return () => {
      unsub();
      window.clearTimeout(backup);
    };
  }, []);

  // A saved account opens at once. A missing session leaves for SSO.
  // Never turn isLoading back on — that pinned the shell on the spinner
  // while /me or a 60s refresh was still running.
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;

    const leaveForStart = () => {
      useAuthStore.getState().setLoading(false);
      if (escapeAlreadyUsed()) {
        setBootTimedOut(true);
        return;
      }
      markEscapeUsed();
      window.location.replace(startUrl());
    };

    const safety = window.setTimeout(() => {
      if (!document.getElementById("hisaby-boot")) return;
      const store = useAuthStore.getState();
      store.setLoading(false);
      if (!store.isAuthenticated && !store.accessToken) leaveForStart();
    }, 9000);

    const store = useAuthStore.getState();
    if (store.isAuthenticated) {
      store.setLoading(false);
      api.bootSession().then((result) => {
        if (cancelled) return;
        window.clearTimeout(safety);
        if (result === "unauthorized" && !useAuthStore.getState().accessToken) {
          useAuthStore.getState().logout();
          leaveForStart();
          return;
        }
        clearEscape();
      });
      return () => {
        cancelled = true;
        window.clearTimeout(safety);
      };
    }

    api.bootSession().then((result) => {
      if (cancelled) {
        useAuthStore.getState().setLoading(false);
        return;
      }
      window.clearTimeout(safety);
      if (result === "ok") {
        clearEscape();
        useAuthStore.getState().setLoading(false);
        return;
      }
      if (result === "unauthorized") {
        useAuthStore.getState().logout();
        leaveForStart();
        return;
      }
      useAuthStore.getState().setLoading(false);
      setBootTimedOut(true);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(safety);
    };
  }, [hydrated, bootRetry]);

  useEffect(() => {
    if (!hydrated || !isAuthenticated || !user) return;
    if (user.role === "ADMIN") return;
    const moduleKey = moduleForDashboardPath(pathname);
    if (!moduleKey) return;
    if (!canAccessModule(user.modulePermissions, moduleKey, "view")) {
      router.replace(homePathForUser(user));
    }
  }, [hydrated, isAuthenticated, user, pathname, router]);

  if (bootTimedOut && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-app" style={bootScreenStyle}>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
          الخادم يستغرق وقتاً أطول من المعتاد
        </p>
        <p style={{ margin: 0, maxWidth: 360, fontSize: 14, lineHeight: 1.6 }}>
          غالباً بعد فترة خمول. أعد المحاولة أو سجّل الدخول من جديد.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
          <button
            type="button"
            style={{
              border: 0,
              borderRadius: 12,
              background: "#059669",
              color: "#fff",
              padding: "10px 16px",
              fontWeight: 700,
              cursor: "pointer",
            }}
            onClick={() => {
              wakeApi();
              clearEscape();
              setBootTimedOut(false);
              setBootRetry((n) => n + 1);
            }}
          >
            إعادة المحاولة
          </button>
          <a
            href={`/api/auth/bhd/start?returnTo=${encodeURIComponent(pathname || "/dashboard")}`}
            style={{
              borderRadius: 12,
              border: "1px solid #64748b",
              padding: "10px 16px",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            تسجيل الدخول
          </a>
        </div>
      </div>
    );
  }

  if (!hydrated || !isAuthenticated) {
    return (
      <div id="hisaby-boot" className="min-h-screen bg-app" style={bootScreenStyle}>
        <style>{`@keyframes hisaby-spin{to{transform:rotate(360deg)}}`}</style>
        <div id="hisaby-boot-pending" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 32,
              height: 32,
              border: "2px solid #10b981",
              borderTopColor: "transparent",
              borderRadius: "999px",
              animation: "hisaby-spin 0.8s linear infinite",
            }}
          />
          <p style={{ margin: 0, fontSize: 14 }}>جاري الاتصال بالخادم…</p>
          <a
            href="/api/auth/bhd/start?returnTo=%2Fdashboard"
            style={{ color: "#34d399", fontWeight: 700, fontSize: 14 }}
          >
            تسجيل الدخول
          </a>
        </div>
        <div id="hisaby-boot-fallback" hidden>
          <p style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700 }}>
            تعذّر فتح لوحة التحكم
          </p>
          <a
            href="/api/auth/bhd/start?returnTo=%2Fdashboard"
            style={{ color: "#34d399", fontWeight: 700 }}
          >
            تسجيل الدخول
          </a>
        </div>
      </div>
    );
  }

  return (
    <MaintenanceGate>
      <div className="min-h-screen bg-app">
        {sidebarOpen && (
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 bg-black/60 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <Sidebar />
        <div
          className={cn(
            "transition-all duration-300 mr-0",
            sidebarCollapsed ? "lg:mr-20" : "lg:mr-72"
          )}
        >
          <Topbar />
          <MobileAppSwitcher
            current="accounting"
            className="sticky top-14 z-30 sm:top-16"
          />
          <main className="p-3 sm:p-4 md:p-6 max-w-[100vw] overflow-x-hidden">
            <Require2faBanner />
            {children}
          </main>
        </div>
        <CommandPalette />
      </div>
    </MaintenanceGate>
  );
}
