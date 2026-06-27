"use client";

import { useState, useTransition } from "react";
import {
  generateWeeklyDigest,
  type WeeklyDigestInput,
} from "@/app/(app)/dashboard/actions";
import {
  parseWeeklyDigest,
  type WeeklyDigestSectionKey,
} from "@/lib/digest";

type Props = WeeklyDigestInput & {
  initialText?: string;
  initialCachedAt?: string;
};

type Tone = "ok" | "bad" | "accent";
type Section = { label: string; tone: Tone; body: string };

const SECTION_META: Record<WeeklyDigestSectionKey, { label: string; tone: Tone }> = {
  wins: { label: "Wins", tone: "ok" },
  atRisk: { label: "At risk", tone: "bad" },
  priorities: { label: "Priorities", tone: "accent" },
};

const TONE_DOT: Record<Tone, string> = {
  ok: "var(--ok)",
  bad: "var(--bad)",
  accent: "var(--accent)",
};

function formatAge(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/** Map the parsed JSON sections onto their display label + tone. */
function toSections(text: string): Section[] {
  return parseWeeklyDigest(text).map((s) => ({
    label: SECTION_META[s.key].label,
    tone: SECTION_META[s.key].tone,
    body: s.body,
  }));
}

export default function WeeklyDigest({
  initialText,
  initialCachedAt,
  ...digestProps
}: Props) {
  const [text, setText] = useState<string | null>(initialText ?? null);
  const [cachedAt, setCachedAt] = useState<string | null>(
    initialCachedAt ?? null
  );
  const [error, setError] = useState<string | null>(null);
  const [noKey, setNoKey] = useState(false);
  const [isPending, startTransition] = useTransition();

  function generate(force = false) {
    setError(null);
    setNoKey(false);
    startTransition(async () => {
      const res = await generateWeeklyDigest(digestProps, force);
      if ("digest" in res) {
        if (toSections(res.digest).length === 0) {
          // A malformed/empty model response parsed to no sections — show a
          // graceful fallback instead of an empty panel.
          setError("Couldn't read the AI response. Please try again.");
        } else {
          setText(res.digest);
          setCachedAt(res.cachedAt);
        }
      } else if ("noKey" in res) {
        setNoKey(true);
      } else {
        setError(res.error);
      }
    });
  }

  const sections = text ? toSections(text) : [];
  const hasDigest = sections.length > 0;

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-callout font-semibold text-[var(--ink-1)]">This week</p>
          <p className="text-footnote mt-0.5 text-[var(--ink-2)]">
            {cachedAt ? `Updated ${formatAge(cachedAt)}` : "AI weekly digest"}
          </p>
        </div>
        <div className="-mr-1 -mt-1 flex shrink-0 items-center">
          {hasDigest ? (
            <button
              type="button"
              onClick={() => generate(true)}
              disabled={isPending}
              aria-label="Refresh weekly digest"
              title="Refresh"
              className="tap grid place-items-center rounded-[var(--r-md)] text-[var(--ink-2)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink-1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:opacity-50"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
                className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`}
              >
                <path
                  fillRule="evenodd"
                  d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H5.498a.75.75 0 0 0-.75.75v3.635a.75.75 0 0 0 1.5 0v-2.033l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm1.23-3.723a.75.75 0 0 0 .219-.53V3.536a.75.75 0 0 0-1.5 0v2.033l-.31-.31a7 7 0 0 0-11.712 3.138.75.75 0 1 0 1.449.39a5.5 5.5 0 0 1 9.201-2.466l.312.311H12.43a.75.75 0 0 0 0 1.5h3.168a.75.75 0 0 0 .53-.219Z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => generate(false)}
              disabled={isPending}
              className="tap press inline-flex items-center justify-center rounded-lg border border-[var(--line-2)] bg-[var(--surface-2)] px-4 text-sm font-medium text-[var(--ink-1)] transition hover:bg-[var(--surface-3)] disabled:opacity-50"
            >
              {isPending ? "Generating…" : "Generate"}
            </button>
          )}
        </div>
      </div>

      {!hasDigest && !isPending && !noKey && !error && (
        <p className="text-footnote mt-4 text-[var(--ink-3)]">
          Get an AI recap of the week — wins, at-risk deals, and top priorities
          from your live pipeline.
        </p>
      )}

      {!hasDigest && isPending && (
        <div className="mt-4 space-y-3" aria-hidden="true">
          {[78, 90, 70].map((w, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-2.5 w-16 animate-pulse rounded-[var(--r-sm)] bg-[var(--surface-2)]" />
              <div
                className="h-3 animate-pulse rounded-[var(--r-sm)] bg-[var(--surface-2)]"
                style={{ width: `${w}%` }}
              />
            </div>
          ))}
        </div>
      )}

      {noKey && (
        <p className="text-footnote mt-4 text-[var(--ink-2)]">
          Set{" "}
          <code className="rounded-[var(--r-sm)] bg-[var(--surface-2)] px-1 py-0.5 text-[var(--ink-1)]">
            DEEPSEEK_API_KEY
          </code>{" "}
          to enable this feature.
        </p>
      )}

      {error && (
        <p className="text-footnote mt-4 text-[var(--bad)]" role="alert">
          {error}
        </p>
      )}

      {hasDigest && (
        <dl className="mt-4 space-y-3.5">
          {sections.map((s, i) => (
            <div key={i} className="flex gap-2.5">
              <span
                aria-hidden="true"
                className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-[var(--r-pill)]"
                style={{ background: TONE_DOT[s.tone] }}
              />
              <div className="min-w-0">
                {s.label && (
                  <dt className="text-caption font-semibold uppercase tracking-wide text-[var(--ink-3)]">
                    {s.label}
                  </dt>
                )}
                <dd className="text-footnote text-[var(--ink-1)]">{s.body}</dd>
              </div>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
