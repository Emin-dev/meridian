import { parseAiJson } from "@/lib/ai-json";

/**
 * Safe parsing of the AI digest model output.
 *
 * Both digests now ask the model for a strict JSON object (see the prompts in
 * `app/(app)/dashboard/actions.ts`). Model output is still untrusted — it can be
 * truncated, fenced, or shaped wrong — so every value is run through
 * `parseAiJson` and guarded with `Array.isArray`/`typeof` checks before use.
 * A malformed response collapses to an empty result the callers render as a
 * graceful fallback, never a throw or a mangled bullet.
 */

/** Shape the daily-digest model is asked to return. */
type DailyDigestShape = { bullets?: unknown };

/**
 * Parse the daily-digest model output (a JSON object `{ bullets: [...] }`) into
 * a clean list of non-empty bullet strings. Returns `[]` on any malformed input.
 */
export function parseDailyDigest(raw: string): string[] {
  const parsed = parseAiJson<DailyDigestShape>(raw);
  const items = Array.isArray(parsed?.bullets) ? parsed.bullets : [];
  return items
    .filter((b): b is string => typeof b === "string")
    .map((b) => b.replace(/^[•\-*]\s*/, "").trim())
    .filter(Boolean);
}

export type WeeklyDigestSectionKey = "wins" | "atRisk" | "priorities";

export type WeeklyDigestSection = {
  key: WeeklyDigestSectionKey;
  body: string;
};

/** Shape the weekly-digest model is asked to return. */
type WeeklyDigestShape = {
  wins?: unknown;
  atRisk?: unknown;
  priorities?: unknown;
};

const WEEKLY_KEYS: WeeklyDigestSectionKey[] = ["wins", "atRisk", "priorities"];

/**
 * Parse the weekly-digest model output (a JSON object
 * `{ wins, atRisk, priorities }`) into ordered sections. Only keys that came
 * back as a non-empty string are included; returns `[]` on any malformed input.
 */
export function parseWeeklyDigest(raw: string): WeeklyDigestSection[] {
  const parsed = parseAiJson<WeeklyDigestShape>(raw);
  if (!parsed) return [];
  const out: WeeklyDigestSection[] = [];
  for (const key of WEEKLY_KEYS) {
    const value = parsed[key];
    if (typeof value === "string" && value.trim()) {
      out.push({ key, body: value.trim() });
    }
  }
  return out;
}
