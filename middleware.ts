import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { isAuthEnabled } from "@/lib/auth-config";

const COOKIE = "session";

export async function middleware(req: NextRequest) {
  // Default-secure: auth gates every matched route whenever a database and a
  // signing secret are configured (see lib/auth-config.ts). A connected DB with
  // real PII must never be served to unauthenticated requests. The only opt-out
  // is an explicit AUTH_ENABLED=false for an un-seeded demo.
  if (!isAuthEnabled()) return NextResponse.next();

  const authSecret = process.env.AUTH_SECRET!;

  const token = req.cookies.get(COOKIE)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    await jwtVerify(token, new TextEncoder().encode(authSecret));
    return NextResponse.next();
  } catch {
    const res = NextResponse.redirect(new URL("/login", req.url));
    res.cookies.delete(COOKIE);
    return res;
  }
}

export const config = {
  // Gate the WHOLE app when auth is enabled. Only the login page, the public
  // health check, and static/image assets are exempt — every data-bearing
  // segment (dashboard, contacts, deals, activity, settings, tasks, sequences,
  // analytics, ask, search) and every /api route is matched so it cannot be
  // reached without a valid session.
  matcher: [
    "/((?!login|api/health|_next/static|_next/image|favicon.ico).*)",
  ],
};
