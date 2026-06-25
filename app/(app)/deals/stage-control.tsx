"use client";

import { useTransition } from "react";
import { moveDealStage } from "./actions";

const STAGE_KEYS = [
  "lead",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
] as const;

type StageKey = (typeof STAGE_KEYS)[number];

interface StageControlProps {
  dealId: number;
  stage: StageKey;
}

export default function StageControl({ dealId, stage }: StageControlProps) {
  const [pending, startTransition] = useTransition();
  const idx = STAGE_KEYS.indexOf(stage);
  const canPrev = idx > 0;
  const canNext = idx < STAGE_KEYS.length - 1;

  function move(newStage: StageKey) {
    startTransition(async () => {
      await moveDealStage(dealId, newStage);
    });
  }

  return (
    <div className="mt-2 flex items-center justify-between border-t border-neutral-700/50 pt-2">
      <button
        type="button"
        disabled={!canPrev || pending}
        onClick={() => move(STAGE_KEYS[idx - 1])}
        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-neutral-500 transition-colors hover:bg-neutral-700 hover:text-neutral-300 disabled:pointer-events-none disabled:opacity-30"
        aria-label="Move to previous stage"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
        {canPrev ? STAGE_KEYS[idx - 1].charAt(0).toUpperCase() + STAGE_KEYS[idx - 1].slice(1) : ""}
      </button>

      <span className="text-[10px] text-neutral-600">
        {idx + 1}/{STAGE_KEYS.length}
      </span>

      <button
        type="button"
        disabled={!canNext || pending}
        onClick={() => move(STAGE_KEYS[idx + 1])}
        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-neutral-500 transition-colors hover:bg-neutral-700 hover:text-neutral-300 disabled:pointer-events-none disabled:opacity-30"
        aria-label="Move to next stage"
      >
        {canNext ? STAGE_KEYS[idx + 1].charAt(0).toUpperCase() + STAGE_KEYS[idx + 1].slice(1) : ""}
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </div>
  );
}
