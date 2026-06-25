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
};

export default function AiDigest(props: Props) {
  const [digest, setDigest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noKey, setNoKey] = useState(false);
  const [isPending, startTransition] = useTransition();

  function generate() {
    setError(null);
    setNoKey(false);
    startTransition(async () => {
      const res = await generateDailyDigest(props);
      if ("digest" in res) {
        setDigest(res.digest);
      } else if ("noKey" in res) {
        setNoKey(true);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-neutral-300">
            What should I do today?
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">AI daily digest</p>
        </div>
        <button
          onClick={generate}
          disabled={isPending}
          className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
        >
          {isPending ? "Generating…" : digest ? "Refresh" : "Generate"}
        </button>
      </div>

      {!digest && !isPending && !noKey && !error && (
        <p className="mt-4 text-xs text-neutral-600">
          Click Generate to get AI‑powered priorities for your day based on the
          current pipeline.
        </p>
      )}

      {isPending && (
        <div className="mt-4 space-y-2">
          {[80, 65, 72].map((w, i) => (
            <div
              key={i}
              className="h-3 animate-pulse rounded bg-neutral-800"
              style={{ width: `${w}%` }}
            />
          ))}
        </div>
      )}

      {noKey && (
        <p className="mt-4 text-xs text-neutral-500">
          Set{" "}
          <code className="rounded bg-neutral-800 px-1 py-0.5">
            DEEPSEEK_API_KEY
          </code>{" "}
          to enable this feature.
        </p>
      )}

      {error && <p className="mt-4 text-xs text-red-400">{error}</p>}

      {digest && (
        <div className="mt-4 text-sm leading-relaxed text-neutral-300 whitespace-pre-wrap">
          {digest}
        </div>
      )}
    </div>
  );
}
