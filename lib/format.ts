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

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/**
 * Formats a date (or ISO string) as a region-neutral "d MMM yyyy" — e.g.
 * "27 Jun 2026" — instead of the US month-day order that Intl's "en-US" locale
 * forces. The workspace is AZN/Azerbaijan, where day-first is the norm. Pass
 * `{ year: false }` to drop the year for same-context lists ("27 Jun"). Returns
 * an em dash for missing values and for a malformed/unparseable date. Built by
 * hand (not Intl) so the order never depends on a locale string.
 */
export function formatDate(
  d: string | Date | null | undefined,
  opts: { year?: boolean } = {},
): string {
  if (d == null) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  const base = `${date.getDate()} ${SHORT_MONTHS[date.getMonth()]}`;
  return opts.year === false ? base : `${base} ${date.getFullYear()}`;
}

/**
 * Formats a date (or ISO string) as day-first date + time — e.g.
 * "27 Jun 2026 at 3:00 PM" — for audit/change-log timestamps. Reuses
 * {@link formatDate} for the day-first date so order never depends on a locale
 * string, and appends the localized time. Returns an em dash for missing or
 * unparseable values.
 */
export function formatDateTime(d: string | Date | null | undefined): string {
  if (d == null) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${formatDate(date)} at ${time}`;
}

/**
 * Formats a date (or ISO string) as "d MMM yyyy" for record detail views,
 * returning an em dash for missing values. Shared by the deals and contacts
 * tables, which previously each defined a byte-identical helper. Thin alias over
 * {@link formatDate} so call sites that always want the year read clearly.
 */
export function formatShortDate(d: string | Date | null): string {
  return formatDate(d);
}

/**
 * Sums a list of money-bearing rows into a per-currency total, returning a map
 * of ISO currency code → summed amount. Rows whose `value` is null, undefined,
 * or non-finite (NaN/Infinity) are skipped, so a bad deal row can never poison
 * a KPI total. Used by the dashboard so mixed-currency pipeline totals are
 * never naively summed under a single symbol.
 */
export function sumByCurrency(
  items: Array<{ value: number | null | undefined; currency: string }>,
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const { value, currency } of items) {
    if (value == null || !Number.isFinite(value)) continue;
    totals[currency] = (totals[currency] ?? 0) + value;
  }
  return totals;
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
