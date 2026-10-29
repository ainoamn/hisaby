import { NextRequest } from "next/server";
import { proxyBhdAuthMutate } from "@/lib/bhd-sso-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return proxyBhdAuthMutate(req, "/api/auth/bhd/rebind");
}

export async function GET(req: NextRequest) {
  return proxyBhdAuthMutate(req, "/api/auth/bhd/rebind");
}
