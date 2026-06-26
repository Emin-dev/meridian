/**
 * The ISO-4217 currency codes Meridian supports. Used to constrain both the
 * settings `defaultCurrency` preference and the per-deal `currency` field, so a
 * request bypassing the UI <select> can't persist a code that `Intl.NumberFormat`
 * would reject at render time with a `RangeError`.
 */
export const VALID_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "JPY",
  "AZN",
] as const;

export type CurrencyCode = (typeof VALID_CURRENCIES)[number];
