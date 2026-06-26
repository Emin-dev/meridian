/**
 * Safe parsing of JSON returned by the AI (DeepSeek).
 *
 * Model output is untrusted: even with `{ json: true }` the response can be
 * truncated, empty, or malformed, and a bare `JSON.parse` would throw and
 * crash the server action. `parseAiJson` wraps the parse in a try/catch and
 * returns `null` on any failure (including non-string input), so callers can
 * fall back to their existing error/empty union instead of throwing.
 *
 * Note: this only guarantees the result is valid JSON of the caller-asserted
 * shape `T` — callers must still validate the parsed value's fields before use.
 */
export function parseAiJson<T>(raw: string): T | null {
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
