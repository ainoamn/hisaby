import { dehydrate, hydrate, type QueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

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
  "/pos",
  "/resto",
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
    { key: ["report-sales-summary"], run: () => body(api.getSalesSummary()) },
    { key: ["report-inventory-summary"], run: () => body(api.getInventorySummary()) },
    { key: ["report-vat-summary"], run: () => body(api.getVatSummary()) },
    { key: ["report-payroll-summary"], run: () => body(api.getPayrollSummary()) },
    { key: ["report-ar-aging"], run: () => body(api.getArAging()) },
    { key: ["report-ap-aging"], run: () => body(api.getApAging()) },
    { key: ["report-cost-center-pl"], run: () => body(api.getCostCenterProfitLoss()) },
    { key: ["report-project-budget"], run: () => body(api.getProjectBudgetReport()) },
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

export function warmWorkspace(client: QueryClient, router: Prefetcher, companyId: string) {
  let cancelled = false;
  let timer = 0;
  let index = 0;
  const jobs = warmJobs(companyId);

  const prefetchRoutes = (cursor: number) => {
    if (cancelled || cursor >= WORKSPACE_HREFS.length) {
      prefetchData();
      return;
    }
    try {
      router.prefetch(WORKSPACE_HREFS[cursor]);
    } catch {
      /* route may be unavailable in this build */
    }
    timer = window.setTimeout(() => prefetchRoutes(cursor + 1), 40);
  };

  const prefetchData = () => {
    if (cancelled || index >= jobs.length || document.hidden) {
      if (!cancelled && index < jobs.length) {
        timer = window.setTimeout(prefetchData, 1000);
      }
      return;
    }
    const job = jobs[index];
    index += 1;
    const existing = client.getQueryState(job.key);
    const fresh =
      existing?.status === "success" &&
      existing.dataUpdatedAt > Date.now() - 30_000;
    const run = fresh
      ? Promise.resolve()
      : client.prefetchQuery({ queryKey: job.key, queryFn: job.run });
    void run.finally(() => {
      if (!cancelled) timer = window.setTimeout(prefetchData, 60);
    });
  };

  timer = window.setTimeout(() => prefetchRoutes(0), 300);
  return () => {
    cancelled = true;
    window.clearTimeout(timer);
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
