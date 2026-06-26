import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE = "session";

export async function middleware(req: NextRequest) {
  const authSecret = process.env.AUTH_SECRET;
  // Auth is OPT-IN. It only gates routes when AUTH_ENABLED=true (and a secret +
  // database exist). By default the app stays fully open and usable — connecting
  // a database must never re-lock everyone out when there is no account yet.
  if (
    process.env.AUTH_ENABLED !== "true" ||
    !authSecret ||
    !process.env.DATABASE_URL
  )
    return NextResponse.next();

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
  matcher: [
    "/dashboard/:path*",
    "/contacts/:path*",
    "/deals/:path*",
    "/activity/:path*",
    "/settings/:path*",
    "/api/contacts/:path*",
    "/api/deals/:path*",
  ],
};
