import { dehydrate, hydrate, type QueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { CASHIER_HREFS, cashierCache } from "@/lib/cashier-cache";

type Prefetcher = { prefetch: (href: string) => void };

const CACHE_PREFIX = "hisaby-rq:";
const CHANNEL = "hisaby-live";

export const WORKSPACE_HREFS = [
  "/dashboard",
  "/sales",
  "/purchases",
  "/accounting",
  "/reports",
  "/reports/financial",
  "/reports/sales",
  "/reports/purchases",
  "/reports/vat",
  "/reports/inventory",
  "/reports/payroll",
  "/reports/audit",
  "/reports/ledger",
  "/reports/cost-centers",
  "/reports/projects",
  "/chart-of-accounts",
  "/journal",
  "/bank-accounts",
  "/cost-centers",
  "/branches",
  "/projects",
  "/assets",
  "/employees",
  "/employee-claims",
  "/commitments",
  "/management-alerts",
  "/disputes",
  "/manager-digests",
  "/inventory",
  "/delivery-notes",
  "/stock-counts",
  "/warehouses",
  "/contacts",
  "/vat",
  "/integrations",
  "/ai-analytics",
  "/settings",
  "/period-locks",
  "/tax-rates",
  "/api-keys",
  "/bhd-r",
  "/document-templates",
  "/custom-fields",
  "/exchange-rates",
  "/fx-revaluation",
  "/subscription",
  "/users",
  "/admin",
  ...CASHIER_HREFS,
];

type WarmJob = {
  key: readonly unknown[];
  run: () => Promise<unknown>;
};

function body<T>(promise: Promise<{ data: T }>) {
  return promise.then((res) => res.data);
}

function warmJobs(companyId: string): WarmJob[] {
  const year = new Date().getFullYear();
  return [
    { key: ["dashboard-stats", companyId], run: () => body(api.getDashboardStats()) },
    { key: ["subscription-modules", companyId], run: () => body(api.getCurrentSubscription({ light: true })) },
    {
      key: ["invoices", undefined, "", "", "", "summary"],
      run: () => body(api.getInvoices({ summary: true, take: 60 })),
    },
    {
      key: ["invoices", "SALES", "", "", "", "summary"],
      run: () => body(api.getInvoices({ type: "SALES", summary: true, take: 60 })),
    },
    {
      key: ["invoices", "PURCHASE", "", "", "", "summary"],
      run: () => body(api.getInvoices({ type: "PURCHASE", summary: true, take: 60 })),
    },
    { key: ["invoice-stats", undefined], run: () => body(api.getInvoiceStats()) },
    { key: ["invoice-stats", "SALES"], run: () => body(api.getInvoiceStats("SALES")) },
    { key: ["invoice-stats", "PURCHASE"], run: () => body(api.getInvoiceStats("PURCHASE")) },
    { key: ["contacts", "CUSTOMER"], run: () => body(api.getContacts("CUSTOMER")) },
    { key: ["contacts", "SUPPLIER"], run: () => body(api.getContacts("SUPPLIER")) },
    { key: ["contacts", "ALL"], run: () => body(api.getContacts()) },
    { key: ["contacts"], run: () => body(api.getContacts()) },
    { key: ["products"], run: () => body(api.getProducts()) },
    { key: ["product-stats"], run: () => body(api.getProductStats()) },
    { key: ["warehouses"], run: () => body(api.getWarehouses()) },
    { key: ["branches"], run: () => body(api.getBranches()) },
    { key: ["branches-for-warehouses"], run: () => body(api.getBranches()) },
    { key: ["bank-accounts"], run: () => body(api.getBankAccounts()) },
    { key: ["cost-centers"], run: () => body(api.getCostCenters()) },
    { key: ["projects"], run: () => body(api.getProjects()) },
    { key: ["assets"], run: () => body(api.getAssets()) },
    { key: ["journals"], run: () => body(api.getJournals()) },
    { key: ["accounts-tree"], run: () => body(api.getAccountsTree()) },
    { key: ["accounts"], run: () => body(api.getAccounts()) },
    { key: ["employees"], run: () => body(api.getEmployees()) },
    { key: ["payroll"], run: () => body(api.getPayrollRuns()) },
    { key: ["employee-claims"], run: () => body(api.getEmployeeClaims()) },
    { key: ["commitments"], run: () => body(api.getCommitments()) },
    { key: ["delivery-notes"], run: () => body(api.getDeliveryNotes()) },
    { key: ["stock-counts"], run: () => body(api.getStockCounts()) },
    { key: ["tax-rates"], run: () => body(api.getTaxRates()) },
    { key: ["document-templates"], run: () => body(api.getDocumentTemplates()) },
    { key: ["exchange-rates"], run: () => body(api.getExchangeRates()) },
    { key: ["custom-fields"], run: () => body(api.getCustomFields()) },
    { key: ["custom-fields", "PRODUCT"], run: () => body(api.getCustomFields("PRODUCT")) },
    { key: ["custom-fields", "CONTACT"], run: () => body(api.getCustomFields("CONTACT")) },
    { key: ["custom-fields", "INVOICE"], run: () => body(api.getCustomFields("INVOICE")) },
    { key: ["users"], run: () => body(api.getUsers()) },
    { key: ["company"], run: () => body(api.getCompany()) },
    { key: ["periods", year], run: () => body(api.getPeriods(year)) },
    { key: ["management-alerts", "OPEN"], run: () => body(api.getManagementAlerts("OPEN")) },
    { key: ["customer-disputes", "OPEN"], run: () => body(api.getCustomerDisputes("OPEN")) },
    { key: ["api-keys"], run: () => body(api.getApiKeys()) },
    { key: ["report-profit-loss"], run: () => body(api.getProfitLoss()) },
    { key: ["report-balance-sheet"], run: () => body(api.getBalanceSheet()) },
    { key: ["report-trial-balance"], run: () => body(api.getTrialBalance()) },
    { key: ["report-cash-flow"], run: () => body(api.getCashFlowReport()) },
    { key: ["vat-invoices"], run: () => body(api.getVatInvoices()) },
    { key: ["vat-stats"], run: () => body(api.getVatStats()) },
    { key: ["ota-config"], run: () => body(api.getOtaConfig()) },
    { key: ["messaging-status"], run: () => body(api.getMessagingStatus()) },
    { key: ["bhd-r-status"], run: () => body(api.getBhdRStatus()) },
    { key: ["bhd-r-readme"], run: () => body(api.getBhdRReadme()) },
    { key: ["ai-analytics"], run: () => body(api.getAiAnalytics()) },
    {
      key: ["ai-pos-shifts"],
      run: async () => {
        const rows = ((await api.listPosShifts()).data || []) as { status?: string }[];
        return rows.filter((row) => row.status === "CLOSED").slice(0, 5);
      },
    },
    { key: ["subscription-current"], run: () => body(api.getCurrentSubscription()) },
    { key: ["subscription-plans"], run: () => body(api.getSubscriptionPlans()) },
    { key: ["platform-gateways"], run: () => body(api.getPlatformGateways()) },
    { key: ["manager-report-subscriptions"], run: () => body(api.getManagerReportSubscriptions()) },
    {
      key: ["fx-revaluation-preview", new Date().toISOString().split("T")[0], 0],
      run: () => body(api.previewFxRevaluation(new Date().toISOString().split("T")[0])),
    },
    { key: ["admin-overview"], run: () => body(api.getAdminOverview()) },
    { key: ["report-sales-summary"], run: () => body(api.getSalesSummary()) },
    { key: ["report-purchase-summary"], run: () => body(api.getPurchaseSummary()) },
    { key: ["report-cash-forecast", 8], run: () => body(api.getCashFlowForecast(8)) },
    { key: ["report-inventory-summary"], run: () => body(api.getInventorySummary()) },
    { key: ["report-vat-summary"], run: () => body(api.getVatSummary()) },
    { key: ["report-payroll-summary"], run: () => body(api.getPayrollSummary()) },
    { key: ["report-ar-aging"], run: () => body(api.getArAging()) },
    { key: ["report-ap-aging"], run: () => body(api.getApAging()) },
    { key: ["report-cost-center-pl"], run: () => body(api.getCostCenterProfitLoss()) },
    { key: ["report-project-budget"], run: () => body(api.getProjectBudgetReport()) },
    { key: ["company-security", companyId], run: () => body(api.getCompanySecurity()) },
  ];
}

function cashierJobs(): WarmJob[] {
  return [
    { key: cashierCache.floor, run: () => body(api.getRestoFloor()) },
    { key: cashierCache.takeaway, run: () => body(api.getRestoActiveOrders("TAKEAWAY")) },
    { key: cashierCache.delivery, run: () => body(api.getRestoActiveOrders("DELIVERY")) },
    { key: cashierCache.menu, run: () => body(api.getRestoMenu()) },
    { key: cashierCache.menu86, run: () => body(api.getRestoMenu86()) },
    { key: cashierCache.stations, run: () => body(api.getRestoStations()) },
    {
      key: cashierCache.recipes,
      run: async () => {
        const [rec, menuRes, productsRes] = await Promise.all([
          api.getRestoRecipes(),
          api.getRestoMenu(),
          api.getProducts(),
        ]);
        const raw = Array.isArray(productsRes.data)
          ? productsRes.data
          : (productsRes.data as { items?: unknown[] })?.items || [];
        return {
          recipes: rec.data.recipes || [],
          menu: menuRes.data.items || [],
          ingredients: (raw as Array<Record<string, unknown>>).map((p) => ({
            id: String(p.id),
            name: String(p.name || ""),
            nameEn: (p.nameEn as string | null) || null,
            sku: String(p.sku || ""),
            unit: String(p.unit || "piece"),
          })),
        };
      },
    },
    { key: cashierCache.kitchen, run: () => body(api.getRestoKitchen()) },
    { key: cashierCache.expo, run: () => body(api.getRestoExpo()) },
    {
      key: cashierCache.reservations,
      run: async () => {
        const [res, floor] = await Promise.all([
          api.getRestoReservations(3),
          api.getRestoFloor(),
        ]);
        const fromZones = (floor.data.zones || []).flatMap(
          (z: { tables?: Array<{ id: string; code: string; name: string | null }> }) => z.tables || [],
        );
        const tables =
          fromZones.length > 0
            ? fromZones
            : (floor.data.tables || []).map((tb: { id: string; code: string; name: string | null }) => ({
                id: tb.id,
                code: tb.code,
                name: tb.name,
              }));
        return { reservations: res.data.reservations || [], tables };
      },
    },
    { key: cashierCache.waitlist, run: () => body(api.getRestoWaitlist()) },
    { key: cashierCache.freeTables, run: () => body(api.getRestoFreeTables()) },
    { key: cashierCache.board, run: () => body(api.getRestoLiveBoard()) },
    { key: cashierCache.reports7, run: () => body(api.getRestoReportsSummary(7)) },
    { key: cashierCache.restoLink, run: () => body(api.getRestoLinkStatus()) },
    { key: cashierCache.posLink, run: () => body(api.getPosLinkStatus()) },
    { key: cashierCache.warehouseCtx, run: () => body(api.getPosWarehouseContext()) },
    { key: cashierCache.approvalsPending, run: () => body(api.listPendingDualControlRequests()) },
    { key: cashierCache.approvalsHistory, run: () => body(api.listDualControlHistory(50)) },
    { key: cashierCache.posContacts, run: () => body(api.getContacts("CUSTOMER")) },
    { key: cashierCache.posBooks, run: () => body(api.getPosBooksSummary()) },
    { key: cashierCache.posShifts, run: () => body(api.listPosShifts()) },
    { key: cashierCache.posShiftsToday, run: () => body(api.getPosShiftsToday()) },
    { key: cashierCache.posShiftDefault, run: () => body(api.getCurrentPosShift(undefined)) },
    {
      key: cashierCache.restoSettings,
      run: async () => {
        const [stations, sections, staff, config] = await Promise.all([
          api.getRestoStations(),
          api.getRestoSectionAssignments(),
          api.getRestoStaff(),
          api.getRestoConfig(),
        ]);
        return {
          stations: stations.data.stations || [],
          sections: sections.data.assignments || [],
          staff: staff.data.staff || [],
          config: config.data,
        };
      },
    },
    {
      key: cashierCache.restoLinkBundle,
      run: async () => {
        const [link, warehouses] = await Promise.all([
          api.getRestoLinkStatus(),
          api.getWarehouses(),
        ]);
        return { link: link.data, warehouses: warehouses.data };
      },
    },
    {
      key: cashierCache.posLinkBundle,
      run: async () => {
        const [link, warehouses] = await Promise.all([
          api.getPosLinkStatus(),
          api.getWarehouses(),
        ]);
        return { link: link.data, warehouses: warehouses.data };
      },
    },
    { key: cashierCache.incentives, run: () => body(api.getPosIncentivesConfig()) },
  ];
}

export function restoreQueryCache(client: QueryClient, companyId: string) {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + companyId);
    if (!raw) return;
    hydrate(client, JSON.parse(raw));
  } catch {
    /* ignore a damaged cache */
  }
}

export function watchQueryCache(client: QueryClient, companyId: string) {
  let timer = 0;
  const save = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      try {
        const snapshot = dehydrate(client, {
          shouldDehydrateQuery: (query) => query.state.status === "success",
        });
        const json = JSON.stringify(snapshot);
        if (json.length > 4_500_000) return;
        sessionStorage.setItem(CACHE_PREFIX + companyId, json);
      } catch {
        /* quota or private mode */
      }
    }, 500);
  };
  const unsubscribe = client.getQueryCache().subscribe(save);
  return () => {
    window.clearTimeout(timer);
    unsubscribe();
  };
}

const WARM_STALE_MS = 5 * 60_000;
const WARM_CONCURRENCY = 8;

function runWarmPool(client: QueryClient, jobs: WarmJob[], isCancelled: () => boolean) {
  let cursor = 0;
  const workers = Array.from({ length: WARM_CONCURRENCY }, async () => {
    while (!isCancelled() && cursor < jobs.length) {
      const job = jobs[cursor];
      cursor += 1;
      if (!job) break;
      const existing = client.getQueryState(job.key);
      if (existing?.status === "success" && existing.dataUpdatedAt > Date.now() - WARM_STALE_MS) {
        continue;
      }
      try {
        await client.prefetchQuery({
          queryKey: job.key,
          queryFn: job.run,
          staleTime: WARM_STALE_MS,
        });
      } catch {
        client.removeQueries({ queryKey: job.key, exact: true });
      }
    }
  });
  void Promise.all(workers);
}

async function warmPosCatalog(client: QueryClient) {
  try {
    const ctx = await client.fetchQuery({
      queryKey: cashierCache.warehouseCtx,
      queryFn: () => body(api.getPosWarehouseContext()),
      staleTime: WARM_STALE_MS,
    });
    const wh =
      ctx?.homeWarehouseId ||
      ctx?.warehouses?.[0]?.id ||
      "";
    if (!wh) return;
    const rows = await client.fetchQuery({
      queryKey: ["pos-inventory-products", wh],
      staleTime: WARM_STALE_MS,
      queryFn: async () => {
        const res = await api.syncPosCatalog(wh);
        return ((res.data?.products as Array<Record<string, unknown>>) || []).map((p) => ({
          ...p,
          category: (p.category as string) || "—",
          unit: (p.unit as string) || "pcs",
          costPrice: (p.costPrice as number | string) ?? 0,
          minQuantity: p.minQuantity as number | string | undefined,
        }));
      },
    });
    await client.prefetchQuery({
      queryKey: ["pos-shift-current", wh],
      staleTime: WARM_STALE_MS,
      queryFn: () => body(api.getCurrentPosShift(wh)),
    });
    if (rows.length) {
      const { saveCatalogCache } = await import("@/lib/pos-catalog-cache");
      await saveCatalogCache(
        rows as unknown as Parameters<typeof saveCatalogCache>[0],
        wh,
      );
    }
  } catch {
    client.removeQueries({ queryKey: cashierCache.warehouseCtx, exact: true });
  }
}

export function warmWorkspace(client: QueryClient, router: Prefetcher, companyId: string) {
  let cancelled = false;

  for (const href of WORKSPACE_HREFS) {
    try {
      router.prefetch(href);
    } catch {
      /* route may be unavailable in this build */
    }
  }

  runWarmPool(client, warmJobs(companyId), () => cancelled);
  runWarmPool(client, cashierJobs(), () => cancelled);
  void warmPosCatalog(client);

  return () => {
    cancelled = true;
  };
}

export function startLiveSync(client: QueryClient, companyId: string) {
  let stopped = false;
  let seen: string | null = null;
  let timer = 0;
  const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL) : null;

  const refresh = () => {
    void client.invalidateQueries();
  };

  const tick = async () => {
    if (stopped || document.hidden) return;
    try {
      const res = await api.getSyncCursor();
      const cursor = res.data?.cursor || "0";
      if (seen === null) {
        seen = cursor;
        return;
      }
      if (seen !== cursor) {
        seen = cursor;
        refresh();
        channel?.postMessage(cursor);
      }
    } catch {
      /* the next tick retries */
    }
  };

  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(async () => {
      await tick();
      if (!stopped) schedule();
    }, 2500);
  };

  const onVisible = () => {
    if (!document.hidden) void tick();
  };

  const onMessage = (event: MessageEvent) => {
    const next = String(event.data || "");
    if (!next || next === seen) return;
    seen = next;
    refresh();
  };

  const unsubscribe = client.getMutationCache().subscribe((event) => {
    if (event.type === "updated" && event.mutation?.state.status === "success") {
      channel?.postMessage(`local:${companyId}:${Date.now()}`);
    }
  });

  channel?.addEventListener("message", onMessage);
  document.addEventListener("visibilitychange", onVisible);
  void tick().finally(() => {
    if (!stopped) schedule();
  });

  return () => {
    stopped = true;
    window.clearTimeout(timer);
    unsubscribe();
    document.removeEventListener("visibilitychange", onVisible);
    channel?.removeEventListener("message", onMessage);
    channel?.close();
  };
}
