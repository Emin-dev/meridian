import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { AuthConfigurationError, isAuthEnabled } from "@/lib/auth-config";

const COOKIE = "session";

// Next.js 16 request boundary. Server Actions and exports also enforce sessions.
export async function proxy(req: NextRequest) {
  // A missing secret or a legacy DB-connected demo opt-out is an outage,
  // never permission to serve private data. Keep configuration details private.
  try {
    if (!isAuthEnabled()) return NextResponse.next();
  } catch (error) {
    if (!(error instanceof AuthConfigurationError)) throw error;
    return NextResponse.json(
      { error: "Service configuration unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const authSecret = process.env.AUTH_SECRET!;

  const token = req.cookies.get(COOKIE)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    await jwtVerify(token, new TextEncoder().encode(authSecret), {
      algorithms: ["HS256"],
    });
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
    "/((?!login$|api/health$|_next/static/|_next/image$|favicon\\.ico$).*)",
  ],
};
