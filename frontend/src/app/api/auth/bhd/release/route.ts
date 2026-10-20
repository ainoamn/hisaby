import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_COOKIES = ["bhd_access", "bhd_refresh", "bhd_csrf"] as const;

/** Clear the product session only. Identity cookies stay on id.bhd-om.com. */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  const secure = process.env.NODE_ENV === "production";
  for (const name of SESSION_COOKIES) {
    res.cookies.set(name, "", {
      path: "/",
      maxAge: 0,
      httpOnly: true,
      sameSite: "lax",
      secure,
    });
  }
  return res;
}
