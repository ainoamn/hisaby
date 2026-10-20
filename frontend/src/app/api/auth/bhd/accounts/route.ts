import { NextRequest } from "next/server";
import { proxyBhdAuth } from "@/lib/bhd-sso-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Read the signed account roster. Does not refresh the session cookie. */
export async function GET(req: NextRequest) {
  return proxyBhdAuth(req, "/api/auth/bhd/accounts");
}
