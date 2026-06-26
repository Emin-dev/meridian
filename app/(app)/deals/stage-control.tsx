"use client";

import { useState, useTransition } from "react";
import { moveDealStage } from "./actions";
import { useToast } from "@/components/toaster";
import MobileActionSheet from "@/components/mobile-action-sheet";
import { DEAL_STAGES as STAGE_KEYS, type StageKey } from "./stages";

interface StageControlProps {
  dealId: number;
  stage: StageKey;
  /** Called immediately before the server action so the parent can update optimistically. */
  onOptimisticMove?: (newStage: string) => void;
  /** Called if the server action fails; parent should revert to this stage. */
  onMoveRollback?: (oldStage: string) => void;
}

export default function StageControl({
  dealId,
  stage,
  onOptimisticMove,
  onMoveRollback,
}: StageControlProps) {
  const { toast } = useToast();
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
      doMove(targetStage);
    }
  }

  function doMove(targetStage: StageKey, closeReason?: string) {
    const originalStage = stage;
    onOptimisticMove?.(targetStage);
    startTransition(async () => {
      const result = await moveDealStage(dealId, targetStage, closeReason);
      if (result?.error) {
        onMoveRollback?.(originalStage);
        toast(result.error, "error");
      } else if (result?.noDb) {
        onMoveRollback?.(originalStage);
        toast("Database not connected", "error");
      }
    });
  }

  function confirmMove() {
    if (!pendingStage) return;
    const stageToMove = pendingStage;
    const reasonText = reason;
    setPendingStage(null);
    setReason("");
    doMove(stageToMove, reasonText);
  }

  function cancelMove() {
    setPendingStage(null);
    setReason("");
  }

  const isTerminal = stage === "won" || stage === "lost";

  const reasonLabel = pendingStage === "won" ? "Won" : "Lost";
  const reasonAccentClass =
    pendingStage === "won" ? "text-[var(--ok)]" : "text-[var(--bad)]";
  const confirmBtnClass =
    pendingStage === "won"
      ? "bg-[var(--ok-tint)] hover:opacity-80 text-[var(--ok)]"
      : "bg-[var(--bad-tint)] hover:opacity-80 text-[var(--bad)]";
  const reasonPlaceholder =
    pendingStage === "lost"
      ? "e.g. Price, timeline, competitor…"
      : "e.g. Contract signed, great fit…";

  return (
    <>
      {/* ── Stepper + Won/Lost. Hidden on desktop while the inline reason panel is open. ── */}
      <div
        className={`mt-2 space-y-1.5 border-t border-[var(--line-1)] pt-2 ${
          pendingStage ? "lg:hidden" : ""
        }`}
      >
        <div className="flex items-center justify-between">
          <button
            type="button"
            disabled={!canPrev || pending}
            onClick={() => requestMove(STAGE_KEYS[idx - 1])}
            className="flex min-h-[44px] items-center gap-1 rounded px-3 py-2 text-sm text-[var(--ink-2)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink-1)] disabled:pointer-events-none disabled:opacity-30 lg:min-h-0 lg:px-1.5 lg:py-0.5 lg:text-xs"
            aria-label="Move to previous stage"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lg:h-2.5 lg:w-2.5"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
            {canPrev
              ? STAGE_KEYS[idx - 1].charAt(0).toUpperCase() +
                STAGE_KEYS[idx - 1].slice(1)
              : ""}
          </button>

          <span className="text-[10px] text-[var(--ink-3)]">
            {idx + 1}/{STAGE_KEYS.length}
          </span>

          <button
            type="button"
            disabled={!canNext || pending}
            onClick={() => requestMove(STAGE_KEYS[idx + 1])}
            className="flex min-h-[44px] items-center gap-1 rounded px-3 py-2 text-sm text-[var(--ink-2)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink-1)] disabled:pointer-events-none disabled:opacity-30 lg:min-h-0 lg:px-1.5 lg:py-0.5 lg:text-xs"
            aria-label="Move to next stage"
          >
            {canNext
              ? STAGE_KEYS[idx + 1].charAt(0).toUpperCase() +
                STAGE_KEYS[idx + 1].slice(1)
              : ""}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lg:h-2.5 lg:w-2.5"
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
              className="flex min-h-[44px] flex-1 items-center justify-center rounded px-2 py-2 text-sm font-medium text-[var(--ok)] transition-colors hover:bg-[var(--ok-tint)] disabled:pointer-events-none disabled:opacity-40 lg:min-h-0 lg:py-1 lg:text-[11px]"
            >
              Won
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => requestMove("lost")}
              className="flex min-h-[44px] flex-1 items-center justify-center rounded px-2 py-2 text-sm font-medium text-[var(--bad)] transition-colors hover:bg-[var(--bad-tint)] disabled:pointer-events-none disabled:opacity-40 lg:min-h-0 lg:py-1 lg:text-[11px]"
            >
              Lost
            </button>
          </div>
        )}
      </div>

      {/* ── Desktop: inline reason panel (replaces the stepper above). ── */}
      {pendingStage && (
        <div className="mt-2 hidden space-y-2 border-t border-[var(--line-1)] pt-2 lg:block">
          <p className="text-xs">
            <span className={`font-medium ${reasonAccentClass}`}>
              Mark as {reasonLabel}
            </span>
            <span className="text-[var(--ink-2)]"> — reason (optional)</span>
          </p>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={reasonPlaceholder}
            className="w-full rounded border border-[var(--line-1)] bg-[var(--surface-2)] px-2 py-1 text-xs text-[var(--ink-1)] placeholder:text-[var(--ink-3)] focus:border-[var(--line-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2"
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
              Confirm {reasonLabel}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={cancelMove}
              className="rounded px-2 py-1 text-[11px] text-[var(--ink-2)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink-1)] disabled:pointer-events-none disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Mobile: reason confirm in a bottom action sheet (desktop-hidden). ── */}
      <div className="lg:hidden">
        <MobileActionSheet
          open={!!pendingStage}
          onClose={cancelMove}
          title={`Mark as ${reasonLabel}`}
        >
          <div className="space-y-3">
            <p className="text-sm text-[var(--ink-2)]">
              Add an optional reason for moving this deal to{" "}
              <span className={`font-medium ${reasonAccentClass}`}>
                {reasonLabel}
              </span>
              .
            </p>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={reasonPlaceholder}
              className="min-h-[44px] w-full rounded-lg border border-[var(--line-1)] bg-[var(--surface-2)] px-3 text-sm text-[var(--ink-1)] placeholder:text-[var(--ink-3)] focus:border-[var(--line-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2"
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmMove();
              }}
            />
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={confirmMove}
                className={`tap flex items-center justify-center rounded-lg px-3 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40 ${confirmBtnClass}`}
              >
                Confirm {reasonLabel}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={cancelMove}
                className="tap flex items-center justify-center rounded-lg px-3 text-sm text-[var(--ink-2)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink-1)] disabled:pointer-events-none disabled:opacity-40"
              >
                Cancel
              </button>
            </div>
          </div>
        </MobileActionSheet>
      </div>
    </>
  );
}
