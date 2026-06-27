/**
 * Canonical, absolute site URL used for metadataBase, OG/Twitter URLs, and robots.
 * Resolution order:
 *   1. NEXT_PUBLIC_SITE_URL (explicit, e.g. https://meridian.app)
 *   2. VERCEL_PROJECT_PRODUCTION_URL / VERCEL_URL (host only — prefixed with https://)
 *   3. http://localhost:3000 (local dev fallback)
 * Always returns an origin with no trailing slash.
 */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return stripTrailingSlash(ensureProtocol(explicit));

  const vercelHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    process.env.VERCEL_URL?.trim();
  if (vercelHost) return stripTrailingSlash(ensureProtocol(vercelHost));

  return "http://localhost:3000";
}

function ensureProtocol(value: string): string {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
