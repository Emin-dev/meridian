import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE = "session";

export async function middleware(req: NextRequest) {
  const authSecret = process.env.AUTH_SECRET;
  // No secret configured → allow through (app is not in auth mode)
  if (!authSecret) return NextResponse.next();

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
  ],
};
