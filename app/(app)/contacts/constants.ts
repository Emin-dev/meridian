/**
 * Shared contact status & source label maps.
 *
 * Centralized here so the list, mobile quick-view, and detail page render the
 * same human-readable labels and tokenized status colors instead of keeping
 * parallel inline copies.
 */

/** Human-readable label for each contact `source` value. */
export const SOURCE_LABELS: Record<string, string> = {
  website: "Website",
  referral: "Referral",
  linkedin: "LinkedIn",
  "cold-outreach": "Cold Outreach",
  other: "Other",
};

/** Label + tokenized badge classes for each contact `status` value. */
export const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  lead: { label: "Lead", className: "bg-[--accent-tint] text-[--accent]" },
  active: { label: "Active", className: "bg-[--ok-tint] text-[--ok]" },
  inactive: { label: "Inactive", className: "bg-[--surface-2] text-[--ink-2]" },
  churned: { label: "Churned", className: "bg-[--bad-tint] text-[--bad]" },
};

/** Ordered status options for selects (bulk actions, etc.). */
export const CONTACT_STATUSES = [
  { value: "lead", label: "Lead" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "churned", label: "Churned" },
] as const;

export type ContactStatus = (typeof CONTACT_STATUSES)[number]["value"];
