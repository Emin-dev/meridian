/**
 * Safe parsing of JSON returned by the AI (DeepSeek).
 *
 * Model output is untrusted: even with `{ json: true }` the response can be
 * truncated, empty, malformed, or — when truncated or a reasoner model is
 * swapped in — wrapped in a ```json markdown fence or prefixed with prose.
 * A bare `JSON.parse` would throw on any of these and crash the server action.
 *
 * `parseAiJson` first tries a direct parse, then falls back to stripping a
 * surrounding markdown code fence and extracting the first balanced `{...}`
 * (or `[...]`) block before parsing. It wraps everything in a try/catch and
 * returns `null` on any failure (including non-string input), so callers can
 * fall back to their existing error/empty union instead of throwing.
 *
 * Note: this only guarantees the result is valid JSON of the caller-asserted
 * shape `T` — callers must still validate the parsed value's fields before use.
 */
export function parseAiJson<T>(raw: string): T | null {
  if (typeof raw !== "string") return null;

  const trimmed = raw.trim();
  if (trimmed === "") return null;

  // 1. Fast path: the response is already clean JSON.
  const direct = tryParse<T>(trimmed);
  if (direct !== undefined) return direct;

  // 2. Strip a surrounding ```json … ``` (or bare ``` … ```) fence, then retry.
  const unfenced = stripCodeFence(trimmed);
  if (unfenced !== trimmed) {
    const fenced = tryParse<T>(unfenced);
    if (fenced !== undefined) return fenced;
  }

  // 3. Extract the first balanced object/array block (handles leading prose
  //    and trailing commentary) and parse that.
  const block = extractFirstJsonBlock(unfenced);
  if (block !== null) {
    const parsed = tryParse<T>(block);
    if (parsed !== undefined) return parsed;
  }

  return null;
}

/** `JSON.parse` that returns `undefined` instead of throwing on failure. */
function tryParse<T>(text: string): T | undefined {
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}

/** Remove a leading/trailing markdown code fence, e.g. ```json … ```. */
function stripCodeFence(text: string): string {
  const match = text.match(/^```[ \t]*[a-zA-Z0-9]*[ \t]*\r?\n([\s\S]*?)\r?\n?```$/);
  return match ? match[1].trim() : text;
}

/**
 * Return the first balanced `{...}` or `[...]` substring, or `null` if none.
 * Tracks string literals and escapes so braces inside strings don't unbalance
 * the count.
 */
function extractFirstJsonBlock(text: string): string | null {
  const start = firstStructuralIndex(text);
  if (start === -1) return null;

  const open = text[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === open) {
      depth++;
    } else if (ch === close) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  return null;
}

/** Index of the first `{` or `[`, whichever comes first. */
function firstStructuralIndex(text: string): number {
  const obj = text.indexOf("{");
  const arr = text.indexOf("[");
  if (obj === -1) return arr;
  if (arr === -1) return obj;
  return Math.min(obj, arr);
}
