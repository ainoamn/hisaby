import { NextResponse, type NextRequest } from "next/server";

/** Client workspace routes. A cookie opens the page; otherwise one hop to start. */
const APP_ROUTES = new Set([
  "accounting",
  "ai-analytics",
  "api-keys",
  "assets",
  "bank-accounts",
  "bank-reconciliation",
  "bhd-r",
  "branches",
  "chart-of-accounts",
  "checkout",
  "commitments",
  "contacts",
  "cost-centers",
  "custom-fields",
  "dashboard",
  "delivery-notes",
  "disputes",
  "document-templates",
  "employee-claims",
  "employees",
  "exchange-rates",
  "fx-revaluation",
  "integrations",
  "inventory",
  "invoices",
  "journal",
  "management-alerts",
  "manager-digests",
  "period-locks",
  "projects",
  "purchases",
  "reports",
  "sales",
  "settings",
  "stock-counts",
  "subscription",
  "tax-rates",
  "users",
  "vat",
  "warehouses",
]);

function freshAccessCookie(token: string | undefined): boolean {
  if (!token) return false;
  const part = token.split(".")[1];
  if (!part) return true;
  try {
    const padded = part.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(padded)) as { exp?: number };
    if (typeof payload.exp === "number" && payload.exp * 1000 <= Date.now()) return false;
    return true;
  } catch {
    return true;
  }
}

function isPrefetch(req: NextRequest): boolean {
  const purpose = req.headers.get("sec-purpose") || req.headers.get("purpose") || "";
  return purpose.toLowerCase().includes("prefetch");
}

export function middleware(req: NextRequest) {
  if (isPrefetch(req)) return NextResponse.next();

  const { pathname } = req.nextUrl;
  const segment = pathname.split("/").filter(Boolean)[0] || "";
  const admin = segment === "admin";
  if (!admin && !APP_ROUTES.has(segment)) return NextResponse.next();

  if (freshAccessCookie(req.cookies.get("bhd_access")?.value)) {
    return NextResponse.next();
  }

  const returnTo = `${pathname}${req.nextUrl.search}`;
  const url = req.nextUrl.clone();
  if (admin) {
    url.pathname = "/api/auth/admin-entry";
    url.search = `?next=${encodeURIComponent(returnTo)}`;
  } else {
    url.pathname = "/api/auth/bhd/start";
    url.search = `?returnTo=${encodeURIComponent(returnTo)}`;
  }
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|backend-api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
