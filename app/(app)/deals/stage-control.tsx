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

  const isTerminal = stage === "won" || stage === "lost";

  return (
    <div className="mt-2 space-y-1.5 border-t border-neutral-700/50 pt-2">
      <div className="flex items-center justify-between">
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

      {!isTerminal && (
        <div className="flex gap-1.5">
          <button
            type="button"
            disabled={pending}
            onClick={() => move("won")}
            className="flex-1 rounded px-2 py-1 text-[11px] font-medium text-green-400 transition-colors hover:bg-green-500/15 disabled:pointer-events-none disabled:opacity-40"
          >
            Won
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => move("lost")}
            className="flex-1 rounded px-2 py-1 text-[11px] font-medium text-red-400 transition-colors hover:bg-red-500/15 disabled:pointer-events-none disabled:opacity-40"
          >
            Lost
          </button>
        </div>
      )}
    </div>
  );
}
