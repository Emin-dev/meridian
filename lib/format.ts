/**
 * Shared formatting helpers.
 *
 * `formatCurrency` centralizes the `Intl.NumberFormat` config that was
 * previously duplicated across the deals and dashboard views, so rounding
 * (no fractional digits) and locale stay consistent everywhere.
 */
export function formatCurrency(amount: number, currency = "USD"): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(safe);
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
