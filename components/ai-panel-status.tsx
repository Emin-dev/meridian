import type { ReactNode } from "react";

interface Props {
  /** No database connected — contact data unavailable. */
  noDb?: boolean;
  /** DEEPSEEK_API_KEY missing in the environment. */
  noKey?: boolean;
  /** Action-level error message, if any. */
  error?: string;
  /**
   * Sentence completing the noKey hint, e.g. "enable AI summaries." — rendered
   * after "Set DEEPSEEK_API_KEY in your environment to ".
   */
  keyHint: string;
  /** Whether the panel currently has a result to display. */
  hasResult: boolean;
  /** Whether an AI action is in progress. */
  isPending: boolean;
  /** Idle hint shown when there is no result, status, or pending action. */
  emptyHint: ReactNode;
}

/**
 * Shared status / empty-state rendering for the contact AI panels (summarize,
 * lead-score, draft-email, next-action, enrich). Purely presentational — each
 * panel keeps its own action and result markup.
 */
export default function AiPanelStatus({
  noDb,
  noKey,
  error,
  keyHint,
  hasResult,
  isPending,
  emptyHint,
}: Props) {
  return (
    <>
      {noDb && (
        <p className="text-xs text-[var(--ink-2)]">
          Database not connected — cannot load contact data.
        </p>
      )}

      {noKey && (
        <p className="text-xs text-[var(--warn)]">
          Set{" "}
          <code className="rounded bg-[var(--surface-2)] px-1 py-0.5">
            DEEPSEEK_API_KEY
          </code>{" "}
          in your environment to {keyHint}
        </p>
      )}

      {error && <p className="text-xs text-[var(--bad)]">{error}</p>}

      {!hasResult && !noDb && !noKey && !error && !isPending && emptyHint}
    </>
  );
}
