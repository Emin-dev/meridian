import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isAuthEnabled } from "@/lib/auth-config";

// Defense in depth for Server Actions, including direct action POST requests.
// Invalid DB-backed configuration throws; only a no-DB demo skips the session.
export async function requireSession(): Promise<void> {
  if (!isAuthEnabled()) {
    return;
  }

  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
}
