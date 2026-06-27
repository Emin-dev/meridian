import { getSession } from "@/lib/auth";
import { checkRateLimit, recordFailure } from "@/lib/rate-limit";

// Friendly message returned (never thrown) when an AI action is rate-limited, so
// the AI panels can surface it through their existing `error` field.
export const AI_RATE_LIMIT_MESSAGE =
  "You're going too fast — try again in a moment.";

// Per-user burst cap for the paid AI server actions. Reuses the shared in-memory
// limiter (lib/rate-limit) so a stuck client retry loop can't hammer DeepSeek
// and blow the monthly cost cap. Keyed by the session userId (a shared "anon"
// bucket when auth is disabled in a demo). Each allowed call counts as one use;
// once the user trips the limit they're locked out until the window expires.
//
// Returns the friendly message when the caller is currently limited, or null
// when the call is allowed.
export async function checkAiRateLimit(): Promise<string | null> {
  const session = await getSession();
  const key = `ai:${session ? session.userId : "anon"}`;

  if (!checkRateLimit(key).allowed) return AI_RATE_LIMIT_MESSAGE;

  // Count this call toward the per-user burst budget.
  recordFailure(key);
  return null;
}
