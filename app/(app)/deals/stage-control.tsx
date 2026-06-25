"use client";

import { useState, useTransition } from "react";
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
  const [pendingStage, setPendingStage] = useState<StageKey | null>(null);
  const [reason, setReason] = useState("");

  const idx = STAGE_KEYS.indexOf(stage);
  const canPrev = idx > 0;
  const canNext = idx < STAGE_KEYS.length - 1;

  function requestMove(targetStage: StageKey) {
    if (targetStage === "won" || targetStage === "lost") {
      setPendingStage(targetStage);
      setReason("");
    } else {
      startTransition(async () => {
        await moveDealStage(dealId, targetStage);
      });
    }
  }

  function confirmMove() {
    if (!pendingStage) return;
    const stageToMove = pendingStage;
    const reasonText = reason;
    setPendingStage(null);
    setReason("");
    startTransition(async () => {
      await moveDealStage(dealId, stageToMove, reasonText);
    });
  }

  function cancelMove() {
    setPendingStage(null);
    setReason("");
  }

  const isTerminal = stage === "won" || stage === "lost";

  if (pendingStage) {
    const label = pendingStage === "won" ? "Won" : "Lost";
    const accentClass =
      pendingStage === "won" ? "text-green-400" : "text-red-400";
    const confirmBtnClass =
      pendingStage === "won"
        ? "bg-green-700/70 hover:bg-green-600/80 text-green-100"
        : "bg-red-700/70 hover:bg-red-600/80 text-red-100";

    return (
      <div className="mt-2 space-y-2 border-t border-neutral-700/50 pt-2">
        <p className="text-xs">
          <span className={`font-medium ${accentClass}`}>Mark as {label}</span>
          <span className="text-neutral-500"> — reason (optional)</span>
        </p>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={
            pendingStage === "lost"
              ? "e.g. Price, timeline, competitor…"
              : "e.g. Contract signed, great fit…"
          }
          className="w-full rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs text-neutral-200 placeholder-neutral-600 focus:border-neutral-500 focus:outline-none"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") confirmMove();
            if (e.key === "Escape") cancelMove();
          }}
        />
        <div className="flex gap-1.5">
          <button
            type="button"
            disabled={pending}
            onClick={confirmMove}
            className={`flex-1 rounded px-2 py-1 text-[11px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-40 ${confirmBtnClass}`}
          >
            Confirm {label}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={cancelMove}
            className="rounded px-2 py-1 text-[11px] text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-neutral-200 disabled:pointer-events-none disabled:opacity-40"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-1.5 border-t border-neutral-700/50 pt-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          disabled={!canPrev || pending}
          onClick={() => requestMove(STAGE_KEYS[idx - 1])}
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
          {canPrev
            ? STAGE_KEYS[idx - 1].charAt(0).toUpperCase() +
              STAGE_KEYS[idx - 1].slice(1)
            : ""}
        </button>

        <span className="text-[10px] text-neutral-600">
          {idx + 1}/{STAGE_KEYS.length}
        </span>

        <button
          type="button"
          disabled={!canNext || pending}
          onClick={() => requestMove(STAGE_KEYS[idx + 1])}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-neutral-500 transition-colors hover:bg-neutral-700 hover:text-neutral-300 disabled:pointer-events-none disabled:opacity-30"
          aria-label="Move to next stage"
        >
          {canNext
            ? STAGE_KEYS[idx + 1].charAt(0).toUpperCase() +
              STAGE_KEYS[idx + 1].slice(1)
            : ""}
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
            onClick={() => requestMove("won")}
            className="flex-1 rounded px-2 py-1 text-[11px] font-medium text-green-400 transition-colors hover:bg-green-500/15 disabled:pointer-events-none disabled:opacity-40"
          >
            Won
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => requestMove("lost")}
            className="flex-1 rounded px-2 py-1 text-[11px] font-medium text-red-400 transition-colors hover:bg-red-500/15 disabled:pointer-events-none disabled:opacity-40"
          >
            Lost
          </button>
        </div>
      )}
    </div>
  );
}
