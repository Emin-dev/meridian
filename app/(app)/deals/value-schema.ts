import { z } from "zod";

/**
 * Single source of truth for validating a deal's monetary value.
 *
 * Both create (`deals/actions.ts`) and edit (`deals/[id]/actions.ts`) flows
 * previously re-implemented the same regex; centralizing it here keeps the two
 * paths in lockstep. The value is stored as a Postgres `numeric` (decimal
 * string), so it's validated as a string rather than a JS number.
 *
 * Accepts a non-negative amount with at most two decimal places (e.g. "0",
 * "1500", "1500.50"). Rejects:
 *  - non-numeric / NaN input ("abc", "1e5", "")
 *  - negative values ("-10")
 *  - over-precision ("10.999")
 *
 * `.nullable()` — an absent amount is represented as `null` by the form
 * parsers, which trim empty inputs to `null` before validation.
 */
const VALUE_PATTERN = /^\d+(\.\d{1,2})?$/;

export const dealValueSchema = z
  .string()
  .regex(VALUE_PATTERN, "Enter a valid amount")
  .refine((v) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0;
  }, "Enter a valid amount")
  .nullable();
