"use client";

import { useState, useTransition } from "react";
import { generateDailyDigest } from "@/app/(app)/dashboard/actions";

type StageData = { stage: string; count: number; value: number };

type Props = {
  totalContacts: number;
  openDealsCount: number;
  pipelineValue: number;
  recentActivities: {
    subject: string;
    type: string;
    contactName?: string | null;
    dealTitle?: string | null;
  }[];
  dealsByStage: StageData[];
  overdueCount: number;
  topContacts: { name: string; leadScore: number }[];
  initialBullets?: string[];
  initialCachedAt?: string;
};

function formatAge(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

export default function AiDigest({
  initialBullets = [],
  initialCachedAt,
  ...digestProps
}: Props) {
  const [bullets, setBullets] = useState<string[]>(initialBullets);
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
      const res = await generateDailyDigest(digestProps, force);
      if ("digest" in res) {
        const parsed = res.digest
          .split("\n")
          .map((line) => line.replace(/^[•\-\*]\s*/, "").trim())
          .filter(Boolean);
        setBullets(parsed);
        setCachedAt(res.cachedAt);
      } else if ("noKey" in res) {
        setNoKey(true);
      } else {
        setError(res.error);
      }
    });
  }

  const hasDigest = bullets.length > 0;

  return (
    <div className="card h-full p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[var(--ink-1)]">
            What should I do today?
          </p>
          <p className="mt-0.5 text-xs text-[var(--ink-2)]">
            {cachedAt ? `Updated ${formatAge(cachedAt)}` : "AI daily digest"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {hasDigest && (
            <button
              type="button"
              onClick={() => generate(true)}
              disabled={isPending}
              aria-label="Refresh daily digest"
              title="Refresh digest"
              className="tap grid place-items-center rounded-[var(--r-md)] text-[var(--ink-2)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink-1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:opacity-50"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`}
              >
                <path
                  fillRule="evenodd"
                  d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H5.498a.75.75 0 0 0-.75.75v3.635a.75.75 0 0 0 1.5 0v-2.033l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm1.23-3.723a.75.75 0 0 0 .219-.53V3.536a.75.75 0 0 0-1.5 0v2.033l-.31-.31a7 7 0 0 0-11.712 3.138.75.75 0 1 0 1.449.39a5.5 5.5 0 0 1 9.201-2.466l.312.311H12.43a.75.75 0 0 0 0 1.5h3.168a.75.75 0 0 0 .53-.219Z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}
          {!hasDigest && (
            <button
              type="button"
              onClick={() => generate(false)}
              disabled={isPending}
              className="tap rounded-[var(--r-md)] bg-[var(--accent)] px-4 text-xs font-medium text-[var(--accent-ink)] transition active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:opacity-50"
            >
              {isPending ? "Generating…" : "Generate"}
            </button>
          )}
        </div>
      </div>

      {!hasDigest && !isPending && !noKey && !error && (
        <p className="mt-4 text-xs text-[var(--ink-3)]">
          Click Generate to get AI‑powered priorities for your day based on the
          current pipeline.
        </p>
      )}

      {!hasDigest && isPending && (
        <div className="mt-4 space-y-2">
          {[80, 65, 72].map((w, i) => (
            <div
              key={i}
              className="h-3 animate-pulse rounded-[var(--r-sm)] bg-[var(--surface-2)]"
              style={{ width: `${w}%` }}
            />
          ))}
        </div>
      )}

      {noKey && (
        <p className="mt-4 text-xs text-[var(--ink-2)]">
          Set{" "}
          <code className="rounded-[var(--r-sm)] bg-[var(--surface-2)] px-1 py-0.5 text-[var(--ink-1)]">
            DEEPSEEK_API_KEY
          </code>{" "}
          to enable this feature.
        </p>
      )}

      {error && (
        <p className="mt-4 text-xs text-[var(--bad)]" role="alert">
          {error}
        </p>
      )}

      {hasDigest && (
        <ul className="mt-4 space-y-2.5">
          {bullets.map((line, i) => (
            <li key={i} className="flex gap-2 text-sm text-[var(--ink-1)]">
              <span className="mt-0.5 shrink-0 text-[var(--accent)]">•</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
