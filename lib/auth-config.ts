// Single source of truth for whether authentication is ENFORCED.
//
// Default-secure: auth is ON whenever a database AND a signing secret are both
// configured. A connected DB holds real PII and is wired to paid AI + mutating
// server actions, so it must NEVER be served to unauthenticated requests just
// because a separate opt-in flag was forgotten.
//
// `AUTH_ENABLED` is only an explicit ESCAPE HATCH: set it to "false" to keep a
// DB-connected demo open while no account has been seeded yet (otherwise the
// login page would lock everyone out). Any other value (or absence) leaves auth
// at its secure default.
//
// With no DATABASE_URL or no AUTH_SECRET, auth stays OFF so the app is always
// publicly demoable — connecting a database is what flips enforcement on.
//
// This module reads only `process.env`, so it is safe to import from the Edge
// middleware runtime as well as Node server actions and route handlers.
export function isAuthEnabled(): boolean {
  if (!process.env.AUTH_SECRET || !process.env.DATABASE_URL) return false;
  if (process.env.AUTH_ENABLED === "false") return false;
  return true;
}
