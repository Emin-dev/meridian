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
