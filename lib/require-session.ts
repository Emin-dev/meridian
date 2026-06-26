import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isAuthEnabled } from "@/lib/auth-config";

// Server-side defense-in-depth for Server Actions. Mirrors middleware.ts:
// default-secure, so this enforces a session whenever a database and a signing
// secret are configured (unless AUTH_ENABLED=false explicitly opts a demo out).
// When auth is enabled, an action invoked without a valid session is bounced to
// /login instead of mutating data.
export async function requireSession(): Promise<void> {
  if (!isAuthEnabled()) {
    return;
  }

  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
}
