/**
 * Shared formatting helpers.
 *
 * `formatCurrency` centralizes the `Intl.NumberFormat` config that was
 * previously duplicated across the deals and dashboard views, so rounding
 * (no fractional digits) and locale stay consistent everywhere.
 */
export function formatCurrency(amount: number, currency = "USD"): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(safe);
  } catch {
    // An invalid ISO-4217 code (e.g. a legacy/bad deal row that bypassed the
    // currency allow-list) makes Intl.NumberFormat throw a RangeError. Never let
    // that crash a money-formatting render — fall back to a plain number + code.
    return `${Math.round(safe).toLocaleString("en-US")} ${currency}`;
  }
}

/**
 * Formats a date (or ISO string) as "Mon D, YYYY" for record detail views,
 * returning an em dash for missing values. Shared by the deals and contacts
 * tables, which previously each defined a byte-identical helper.
 */
export function formatShortDate(d: string | Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Compares two decimal-string (or null/undefined) values numerically, so that
 * equivalent representations like "100" and "100.00" are treated as equal.
 * Falls back to strict string equality when either side isn't a parseable
 * number. Used by the deal update actions to detect real value changes before
 * recording a deal event. Previously duplicated in both deal action files.
 */
export function numericEqual(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const an = a ?? null,
    bn = b ?? null;
  if (an === null && bn === null) return true;
  if (an === null || bn === null) return false;
  const fa = parseFloat(an),
    fb = parseFloat(bn);
  return isNaN(fa) || isNaN(fb) ? an === bn : fa === fb;
}
