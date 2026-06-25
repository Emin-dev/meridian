"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { askCrm, type AskResult } from "./actions";

const EXAMPLES = [
  "Which deals are stalling?",
  "Who haven't I contacted in 2 weeks?",
  "What deals are closing this month?",
  "Show me high-value leads",
];

export default function AskForm({
  hasDb,
  hasKey,
}: {
  hasDb: boolean;
  hasKey: boolean;
}) {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AskResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const canAsk = hasDb && hasKey;

  function submit(q: string) {
    const trimmed = q.trim();
    if (!trimmed || !canAsk) return;
    setResult(null);
    startTransition(async () => {
      const r = await askCrm(trimmed);
      setResult(r);
    });
  }

  return (
    <div className="space-y-5">
      {/* Guard banners */}
      {!hasDb && (
        <div className="card px-5 py-8 text-center">
          <p className="text-body text-[--ink-2]">Database not connected.</p>
          <p className="mt-1 text-footnote text-[--ink-3]">
            Set <code className="text-[--ink-2]">DATABASE_URL</code> to enable AI search.
          </p>
        </div>
      )}

      {hasDb && !hasKey && (
        <div className="card px-5 py-8 text-center">
          <p className="text-body text-[--ink-2]">AI not configured.</p>
          <p className="mt-1 text-footnote text-[--ink-3]">
            Set <code className="text-[--ink-2]">DEEPSEEK_API_KEY</code> to enable Ask your CRM.
          </p>
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(question);
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask anything about your CRM…"
          disabled={isPending || !canAsk}
          aria-label="Ask your CRM"
          className="tap flex-1 min-w-0 rounded-[--r-md] border border-[--line-1] bg-[--surface-1] px-4 text-body text-[--ink-1] placeholder:text-[--ink-3] focus:border-[--accent] focus:outline-none disabled:opacity-40 [color-scheme:dark]"
        />
        <button
          type="submit"
          disabled={isPending || !question.trim() || !canAsk}
          className="tap flex shrink-0 items-center justify-center gap-2 rounded-[--r-md] bg-[--accent] px-4 text-body font-medium text-white transition active:scale-[0.98] disabled:opacity-40"
        >
          {isPending ? (
            <span
              className="block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
              aria-label="Thinking…"
            />
          ) : (
            "Ask"
          )}
        </button>
      </form>

      {/* Example chips */}
      {canAsk && !result && !isPending && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                setQuestion(ex);
                submit(ex);
              }}
              className="tap rounded-[--r-pill] border border-[--line-1] bg-[--surface-1] px-3 text-footnote text-[--ink-2] transition hover:border-[--line-2] hover:text-[--ink-1]"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {/* Loading skeleton */}
      {isPending && (
        <div className="card space-y-3 p-5">
          <div className="h-4 w-3/4 animate-pulse rounded bg-[--surface-2]" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-[--surface-2]" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-[--surface-2]" />
        </div>
      )}

      {/* Result */}
      {result && !isPending && (
        <div className="space-y-4">
          {/* AI answer */}
          <div className="card p-5">
            <p className="text-body leading-relaxed text-[--ink-1]">{result.answer}</p>
          </div>

          {/* Matched contacts */}
          {result.contacts.length > 0 && (
            <div>
              <p className="mb-2 text-footnote font-medium text-[--ink-2]">
                Contacts ({result.contacts.length})
              </p>
              <div className="card divide-y divide-[--line-1] overflow-hidden">
                {result.contacts.map((c) => (
                  <Link
                    key={c.id}
                    href={`/contacts/${c.id}`}
                    className="tap flex items-center gap-3 px-4 transition-colors hover:bg-[--surface-2]"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[--surface-2] text-footnote font-medium text-[--ink-1]">
                      {c.name[0]?.toUpperCase() ?? "?"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-body text-[--ink-1]">
                      {c.name}
                    </span>
                    <svg
                      width={16}
                      height={16}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="shrink-0 text-[--ink-3]"
                      aria-hidden="true"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Matched deals */}
          {result.deals.length > 0 && (
            <div>
              <p className="mb-2 text-footnote font-medium text-[--ink-2]">
                Deals ({result.deals.length})
              </p>
              <div className="card divide-y divide-[--line-1] overflow-hidden">
                {result.deals.map((d) => (
                  <Link
                    key={d.id}
                    href={`/deals/${d.id}`}
                    className="tap flex items-center gap-3 px-4 transition-colors hover:bg-[--surface-2]"
                  >
                    <span className="min-w-0 flex-1 truncate text-body text-[--ink-1]">
                      {d.title}
                    </span>
                    <svg
                      width={16}
                      height={16}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="shrink-0 text-[--ink-3]"
                      aria-hidden="true"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
