import { NextRequest, NextResponse } from "next/server";
import { backendBase } from "@/lib/bhd-sso-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readCookie(header: string, name: string): string | null {
  for (const part of header.split(";")) {
    const row = part.trim();
    const eq = row.indexOf("=");
    if (eq <= 0) continue;
    if (row.slice(0, eq) !== name) continue;
    try {
      return decodeURIComponent(row.slice(eq + 1));
    } catch {
      return row.slice(eq + 1);
    }
  }
  return null;
}

/** Product session as the identity sub. No redirect. */
export async function GET(req: NextRequest) {
  const access = readCookie(req.headers.get("cookie") || "", "bhd_access");
  if (!access) return NextResponse.json({ user: null });

  try {
    const upstream = await fetch(`${backendBase()}/api/auth/me`, {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${access}`,
      },
      cache: "no-store",
    });
    if (!upstream.ok) return NextResponse.json({ user: null });
    const data = (await upstream.json()) as {
      bhdSub?: string | null;
      bhd_sub?: string | null;
      email?: string | null;
    };
    const id = data.bhdSub || data.bhd_sub || null;
    return NextResponse.json({
      user: id ? { id, email: typeof data.email === "string" ? data.email : undefined } : null,
    });
  } catch {
    return NextResponse.json({ user: null });
  }
}
