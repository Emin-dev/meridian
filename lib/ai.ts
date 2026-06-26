import { createHash } from "node:crypto";

export type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatOptions = {
  /**
   * Explicit model override. When omitted, the cheap flash model is used
   * (DEEPSEEK_MODEL_FLASH) unless `hard` is set, which opts into the pro model.
   */
  model?: string;
  /** Request a strict JSON object response. */
  json?: boolean;
  /**
   * Opt into the more capable (and more expensive) pro model for genuinely
   * hard synthesis. Defaults to false — routine calls stay on flash.
   */
  hard?: boolean;
  /** Cap on completion tokens. Defaults to a conservative limit. */
  maxTokens?: number;
};

type DeepSeekResponse = {
  choices: Array<{
    message: { content: string };
  }>;
};

// Default output cap keeps routine calls cheap and bounded. Callers that need
// more can pass `maxTokens` explicitly.
const DEFAULT_MAX_TOKENS = 1024;

// Hard wall-clock budget for a single request before we bail with a clear error.
// Kept under Vercel's 10s free-tier function limit so the request fails cleanly
// with our own error rather than being killed mid-flight by the platform.
const REQUEST_TIMEOUT_MS = 9_000;

// How long a successful response stays cached. Keeps the in-memory cache from
// holding stale answers indefinitely in a long-lived server process.
const CACHE_TTL_MS = 5 * 60 * 1000;

// Bound the cache so a long-running process can't grow it without limit.
const CACHE_MAX_ENTRIES = 256;

type CacheEntry = { value: string; expires: number };

// In-memory cache keyed by a hash of (model + options + messages). Module-level
// so it persists across calls within a single server instance. This is a best-
// effort de-dupe of identical calls, not a correctness-critical store.
const responseCache = new Map<string, CacheEntry>();

function cacheKey(
  model: string,
  json: boolean,
  maxTokens: number,
  messages: Message[]
): string {
  const payload = JSON.stringify({ model, json, maxTokens, messages });
  return createHash("sha256").update(payload).digest("hex");
}

function getCached(key: string): string | undefined {
  const entry = responseCache.get(key);
  if (!entry) return undefined;
  if (entry.expires <= Date.now()) {
    responseCache.delete(key);
    return undefined;
  }
  // Refresh recency for a rough LRU on the bounded map.
  responseCache.delete(key);
  responseCache.set(key, entry);
  return entry.value;
}

function setCached(key: string, value: string): void {
  responseCache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
  // Evict oldest entries when over capacity (Map preserves insertion order).
  while (responseCache.size > CACHE_MAX_ENTRIES) {
    const oldest = responseCache.keys().next().value;
    if (oldest === undefined) break;
    responseCache.delete(oldest);
  }
}

/**
 * Call the DeepSeek chat-completions API.
 *
 * Signature is intentionally stable: `chat(messages, options?)`. Every existing
 * caller — `chat(messages)` and `chat(messages, { json: true })` — keeps
 * working unchanged. New optional fields (`hard`, `maxTokens`) are additive.
 *
 * Behaviour:
 * - Defaults to the cheap flash model; pass `hard: true` for the pro model.
 * - Thinking mode is disabled for routine calls (cost/latency).
 * - Output tokens are capped (`maxTokens`, default {@link DEFAULT_MAX_TOKENS}).
 * - Identical calls are served from an in-memory cache.
 * - Requests time out after 15s and surface a short, clear error rather than
 *   hanging or leaking a raw stack/abort error.
 *
 * Note: the missing-API-key case still throws an Error whose message contains
 * "DEEPSEEK_API_KEY", because callers detect the unconfigured state by matching
 * on that substring.
 */
export async function chat(
  messages: Message[],
  options: ChatOptions = {}
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error(
      "DEEPSEEK_API_KEY is not set. Configure it in your environment to use AI features."
    );
  }

  const baseUrl = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";

  // Model selection: explicit override wins; otherwise pick pro only for hard
  // synthesis, falling back to flash for everything routine.
  const flashModel = process.env.DEEPSEEK_MODEL_FLASH ?? "deepseek-chat";
  const proModel =
    process.env.DEEPSEEK_MODEL_PRO ??
    process.env.DEEPSEEK_MODEL ??
    "deepseek-reasoner";
  const model = options.model ?? (options.hard ? proModel : flashModel);

  const json = options.json ?? false;
  const maxTokens =
    options.maxTokens && options.maxTokens > 0
      ? options.maxTokens
      : DEFAULT_MAX_TOKENS;

  // Serve identical calls from cache to skip duplicate network round-trips.
  const key = cacheKey(model, json, maxTokens, messages);
  const cached = getCached(key);
  if (cached !== undefined) return cached;

  const body: Record<string, unknown> = {
    model,
    messages,
    max_tokens: maxTokens,
  };

  // Disable thinking mode for routine flash calls. Pro/hard calls may rely on
  // reasoning, so leave it to the model default there.
  if (!options.hard) {
    body.thinking = { type: "disabled" };
  }

  if (json) {
    body.response_format = { type: "json_object" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    // Graceful fallback: turn aborts / network errors into a short, clear
    // message instead of leaking a raw AbortError or fetch stack.
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        `AI request timed out after ${REQUEST_TIMEOUT_MS / 1000}s. Please try again.`
      );
    }
    throw new Error("AI request failed: could not reach the AI service.");
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    // Log the raw upstream detail server-side for diagnosability, but never let
    // it reach the caller: the AI panels render this message verbatim in their
    // error state, and a provider error body can contain noise or a masked API
    // key (e.g. on a 401). Surface a short, friendly, status-aware message
    // instead. (This branch never contains "DEEPSEEK_API_KEY", so it does not
    // affect callers' no-key detection.)
    const text = await res.text().catch(() => "");
    if (text) {
      console.error(`DeepSeek request failed (${res.status}): ${text.slice(0, 500)}`);
    }
    const friendly =
      res.status === 429
        ? "AI is busy right now (rate limited). Please try again in a moment."
        : res.status === 401 || res.status === 403
          ? "AI service rejected the request. Check the configured API key."
          : "AI request failed. Please try again.";
    throw new Error(friendly);
  }

  let data: DeepSeekResponse;
  try {
    data = (await res.json()) as DeepSeekResponse;
  } catch {
    throw new Error("AI request failed: malformed response from the AI service.");
  }

  const content = data.choices?.[0]?.message?.content;
  if (content == null) {
    throw new Error("AI request failed: empty response from the AI service.");
  }

  setCached(key, content);
  return content;
}
