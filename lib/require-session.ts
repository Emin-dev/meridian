import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

// Server-side defense-in-depth for Server Actions. Mirrors middleware.ts: auth
// is OPT-IN, so this is a no-op unless AUTH_ENABLED=true and both a secret and a
// database are configured. When auth IS enabled, an action invoked without a
// valid session is bounced to /login instead of mutating data.
export async function requireSession(): Promise<void> {
  if (
    process.env.AUTH_ENABLED !== "true" ||
    !process.env.AUTH_SECRET ||
    !process.env.DATABASE_URL
  ) {
    return;
  }

  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
}
