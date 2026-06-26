"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { createSession, destroySession, verifyPassword } from "@/lib/auth";
import { checkRateLimit, recordFailure, recordSuccess } from "@/lib/rate-limit";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginState = { error: string } | null;

export async function login(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) return { error: "Invalid email or password." };

  // Throttle before any DB lookup or scrypt verification so credential-stuffing
  // can't run unbounded. Key on both the source IP and the target email so a
  // single IP rotating emails (or many IPs hitting one account) is both bounded.
  const h = await headers();
  const ip = (
    h.get("x-forwarded-for")?.split(",")[0] ??
    h.get("x-real-ip") ??
    "unknown"
  ).trim();
  const ipKey = `login:ip:${ip}`;
  const emailKey = `login:email:${parsed.data.email.toLowerCase()}`;

  const limited = [checkRateLimit(ipKey), checkRateLimit(emailKey)].find(
    (r) => !r.allowed
  );
  if (limited) {
    const secs = Math.ceil(limited.retryAfterMs / 1000);
    return { error: `Too many attempts. Try again in ${secs}s.` };
  }

  const db = getDb();
  if (!db) return { error: "Database not configured." };

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);

  if (!user) {
    recordFailure(ipKey);
    recordFailure(emailKey);
    return { error: "Invalid email or password." };
  }

  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) {
    recordFailure(ipKey);
    recordFailure(emailKey);
    return { error: "Invalid email or password." };
  }

  try {
    await createSession(user.id, user.email);
  } catch {
    return { error: "Auth is not configured (AUTH_SECRET missing)." };
  }

  recordSuccess(ipKey);
  recordSuccess(emailKey);
  redirect("/dashboard");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
