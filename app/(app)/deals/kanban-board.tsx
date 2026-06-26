"use client";

import { useState } from "react";
import { moveDealStage } from "./actions";
import { useToast } from "@/components/toaster";
import MobileActionSheet from "@/components/mobile-action-sheet";
import KanbanColumn from "./kanban-column";
import KanbanCard from "./kanban-card";
import type { DealWithContact } from "./types";
import { STAGES, type StageKey } from "./stages";
import { formatCurrency } from "@/lib/format";

export default function KanbanBoard({
  initialDeals,
}: {
  initialDeals: DealWithContact[];
}) {
  const { toast } = useToast();
  const [deals, setDeals] = useState(initialDeals);

  // Guards against drag races: while an optimistic move is in flight a second
  // fast drag could build on stale state and diverge from the server, so we
  // block initiating a new drag/drop until the pending move reconciles.
  const [moving, setMoving] = useState(false);

  // Phone view: which stage column is selected
  const [selectedStage, setSelectedStage] = useState<StageKey>("lead");

  // Phone view: bottom sheet for moving a deal to a different stage
  const [sheetDealId, setSheetDealId] = useState<number | null>(null);
  const [sheetTerminal, setSheetTerminal] = useState<"won" | "lost" | null>(null);
  const [sheetReason, setSheetReason] = useState("");

  async function handleMove(dealId: number, toStage: StageKey, closeReason?: string) {
    const deal = deals.find((d) => d.id === dealId);
    if (!deal) return;
    const fromStage = deal.stage as StageKey;
    if (fromStage === toStage) return;

    // Optimistic update — move the deal immediately in local state
    setMoving(true);
    setDeals((prev) =>
      prev.map((d) => (d.id === dealId ? { ...d, stage: toStage } : d))
    );

    try {
      const result = await moveDealStage(dealId, toStage, closeReason);

      if (result?.error) {
        // Revert to original stage and notify the user
        setDeals((prev) =>
          prev.map((d) => (d.id === dealId ? { ...d, stage: fromStage } : d))
        );
        toast(result.error, "error");
      }
    } finally {
      setMoving(false);
    }
  }

  const dealsByStage = Object.fromEntries(
    STAGES.map((s) => [s.key, deals.filter((d) => d.stage === s.key)])
  ) as Record<StageKey, DealWithContact[]>;

  // ── Phone sheet helpers ──────────────────────────────────────────────────
  function openSheet(dealId: number) {
    setSheetDealId(dealId);
    setSheetTerminal(null);
    setSheetReason("");
  }

  function closeSheet() {
    setSheetDealId(null);
    setSheetTerminal(null);
    setSheetReason("");
  }

  function handleSheetPick(stage: StageKey) {
    if (sheetDealId === null) return;
    if (stage === "won" || stage === "lost") {
      setSheetTerminal(stage);
      setSheetReason("");
    } else {
      void handleMove(sheetDealId, stage);
      closeSheet();
    }
  }

  function confirmSheetTerminal() {
    if (sheetDealId === null || !sheetTerminal) return;
    void handleMove(sheetDealId, sheetTerminal, sheetReason);
    closeSheet();
  }

  // Desktop drag-drop: terminal columns prompt for a reason before committing,
  // matching the card-select and stage-control paths; other columns move directly.
  function handleDrop(dealId: number, toStage: StageKey) {
    // Ignore drops while a move is still in flight — the dragged card may be
    // built on stale state that hasn't reconciled with the server yet.
    if (moving) return;
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stage === toStage) return;
    if (toStage === "won" || toStage === "lost") {
      setSheetDealId(dealId);
      setSheetTerminal(toStage);
      setSheetReason("");
    } else {
      void handleMove(dealId, toStage);
    }
  }

  const sheetDeal = sheetDealId !== null
    ? deals.find((d) => d.id === sheetDealId)
    : null;

  return (
    <div className="@container min-w-0">
      {/* ── Phone view (container < 640px) ──────────────────────────────── */}
      <div className="min-w-0 @[640px]:hidden">
        {/* Sticky segmented stage control */}
        <div className="sticky top-0 z-10 min-w-0 glass border-b border-[var(--line-1)] py-2">
          <div
            role="tablist"
            aria-label="Pipeline stages"
            className="no-scrollbar flex gap-1.5 overflow-x-auto"
          >
            {STAGES.map((stage) => {
              const count = dealsByStage[stage.key].length;
              const isActive = selectedStage === stage.key;
              return (
                <button
                  key={stage.key}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setSelectedStage(stage.key)}
                  className={`tap flex-none whitespace-nowrap rounded-[var(--r-pill)] px-3 text-footnote font-medium transition-colors active:scale-[0.97] ${
                    isActive
                      ? "bg-[var(--accent)] text-[var(--accent-ink)]"
                      : "text-[var(--ink-2)] hover:text-[var(--ink-1)]"
                  }`}
                >
                  {stage.label}
                  {count > 0 && (
                    <span
                      className={`ml-1.5 text-caption ${
                        isActive ? "opacity-70" : "text-[var(--ink-3)]"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Stacked card list for the selected stage */}
        <div className="flex flex-col gap-3 py-4">
          {(dealsByStage[selectedStage] ?? []).length === 0 ? (
            <div className="flex min-h-32 items-center justify-center rounded-[var(--r-md)] border border-dashed border-[var(--line-1)]">
              <p className="text-center text-footnote text-[var(--ink-3)]">
                No deals in this stage
              </p>
            </div>
          ) : (
            (dealsByStage[selectedStage] ?? []).map((deal) => (
              <KanbanCard
                key={deal.id}
                deal={deal}
                onMove={(id, stage, reason) =>
                  void handleMove(id, stage as StageKey, reason)
                }
                onMoveRequest={openSheet}
                phoneMode
              />
            ))
          )}
        </div>
      </div>

      {/* ── Desktop view (container ≥ 640px) ────────────────────────────── */}
      {/* Horizontal swipe lane: the track owns the overflow so the page never
          widens; snap aligns each stage, and a safe-area-aware trailing gutter
          lets the last column clear the screen edge / notch on touch devices. */}
      <div className="hidden min-w-0 @[640px]:block overflow-x-auto snap-x snap-mandatory pb-4 [scroll-padding-inline-start:0.25rem] pe-[max(1rem,env(safe-area-inset-right))]">
        <div className="flex gap-4">
          {STAGES.map((stage) => {
            const cards = dealsByStage[stage.key] ?? [];
            const stageTotal = cards
              .filter((d) => d.value)
              .reduce((sum, d) => sum + parseFloat(d.value!), 0);

            return (
              <KanbanColumn
                key={stage.key}
                stageKey={stage.key}
                onDrop={(id) => handleDrop(id, stage.key)}
              >
                {/* Column header */}
                <div className="flex items-center justify-between border-b border-[var(--line-1)] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${stage.dot}`} />
                    <span className="text-xs font-medium uppercase tracking-wide text-[var(--ink-2)]">
                      {stage.label}
                    </span>
                  </div>
                  <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--ink-2)]">
                    {cards.length}
                  </span>
                </div>

                {/* Stage value */}
                {stageTotal > 0 && (
                  <div className="border-b border-[var(--line-1)] px-4 py-2">
                    <p className="text-xs text-[var(--ink-3)]">
                      {formatCurrency(stageTotal)}
                    </p>
                  </div>
                )}

                {/* Cards */}
                <div className="flex flex-1 flex-col gap-3 p-3">
                  {cards.length === 0 ? (
                    <div className="flex min-h-24 flex-1 items-center justify-center rounded-[var(--r-md)] border border-dashed border-[var(--line-1)]">
                      <p className="text-center text-xs text-[var(--ink-3)]">
                        No deals
                      </p>
                    </div>
                  ) : (
                    cards.map((deal) => (
                      <KanbanCard
                        key={deal.id}
                        deal={deal}
                        dragDisabled={moving}
                        onMove={(id, stage, reason) =>
                          void handleMove(id, stage as StageKey, reason)
                        }
                      />
                    ))
                  )}
                </div>
              </KanbanColumn>
            );
          })}
        </div>
      </div>

      {/* ── Bottom sheet: phone stage picker ────────────────────────────── */}
      <MobileActionSheet open={sheetDealId !== null} onClose={closeSheet}>
        {sheetTerminal ? (
          /* Won / Lost reason flow */
          <div className="space-y-3">
            <p className="text-body font-semibold text-[var(--ink-1)]">
              Reason for{" "}
              <span
                className={
                  sheetTerminal === "won" ? "text-[var(--ok)]" : "text-[var(--bad)]"
                }
              >
                {sheetTerminal === "won" ? "Won" : "Lost"}
              </span>
              <span className="text-footnote font-normal text-[var(--ink-3)]">
                {" "}
                (optional)
              </span>
            </p>
            <input
              type="text"
              value={sheetReason}
              onChange={(e) => setSheetReason(e.target.value)}
              placeholder={
                sheetTerminal === "lost"
                  ? "e.g. Price, competitor…"
                  : "e.g. Contract signed…"
              }
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmSheetTerminal();
                if (e.key === "Escape") closeSheet();
              }}
              className="tap w-full rounded-[var(--r-md)] border border-[var(--line-1)] bg-[var(--surface-1)] px-3 text-body text-[var(--ink-1)] placeholder-[var(--ink-3)] focus:border-[var(--line-2)] focus:outline-none [color-scheme:dark]"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={confirmSheetTerminal}
                className={`tap flex-1 rounded-[var(--r-md)] px-4 text-body font-medium transition-colors ${
                  sheetTerminal === "won"
                    ? "bg-[var(--ok-tint)] text-[var(--ok)] hover:bg-[var(--ok)]/25"
                    : "bg-[var(--bad-tint)] text-[var(--bad)] hover:bg-[var(--bad)]/25"
                }`}
              >
                Confirm {sheetTerminal === "won" ? "Won" : "Lost"}
              </button>
              <button
                type="button"
                onClick={closeSheet}
                className="tap rounded-[var(--r-md)] border border-[var(--line-1)] px-4 text-body text-[var(--ink-2)] transition-colors hover:text-[var(--ink-1)]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          /* Stage picker list */
          <div>
            <p className="mb-2 text-caption uppercase tracking-wider text-[var(--ink-3)]">
              Move to stage
            </p>
            <div className="flex flex-col divide-y divide-[var(--line-1)]">
              {STAGES.map((stage) => {
                const isCurrent = sheetDeal?.stage === stage.key;
                return (
                  <button
                    key={stage.key}
                    type="button"
                    onClick={() => handleSheetPick(stage.key)}
                    disabled={isCurrent}
                    className="tap press flex items-center gap-3 px-1 text-left text-body text-[var(--ink-1)] hover:text-[var(--accent)] disabled:opacity-40"
                  >
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${stage.dot}`}
                    />
                    <span className="flex-1">{stage.label}</span>
                    {isCurrent && (
                      <span className="text-caption text-[var(--ink-3)]">
                        Current
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </MobileActionSheet>
    </div>
  );
}
