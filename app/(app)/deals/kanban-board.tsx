"use client";

import { useState } from "react";
import { moveDealStage } from "./actions";
import { useToast } from "@/components/toaster";
import KanbanColumn from "./kanban-column";
import KanbanCard from "./kanban-card";
import type { Deal, Contact } from "@/db/schema";

type DealWithContact = Deal & { contact: Contact | null };

const STAGES = [
  { key: "lead" as const, label: "Lead", dot: "bg-blue-500" },
  { key: "qualified" as const, label: "Qualified", dot: "bg-violet-500" },
  { key: "proposal" as const, label: "Proposal", dot: "bg-yellow-500" },
  { key: "negotiation" as const, label: "Negotiation", dot: "bg-orange-500" },
  { key: "won" as const, label: "Won", dot: "bg-green-500" },
  { key: "lost" as const, label: "Lost", dot: "bg-red-500" },
] as const;

type StageKey = (typeof STAGES)[number]["key"];

const fmtUSD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export default function KanbanBoard({
  initialDeals,
}: {
  initialDeals: DealWithContact[];
}) {
  const { toast } = useToast();
  const [deals, setDeals] = useState(initialDeals);

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
    setDeals((prev) =>
      prev.map((d) => (d.id === dealId ? { ...d, stage: toStage } : d))
    );

    const result = await moveDealStage(dealId, toStage, closeReason);

    if (result?.error) {
      // Revert to original stage and notify the user
      setDeals((prev) =>
        prev.map((d) => (d.id === dealId ? { ...d, stage: fromStage } : d))
      );
      toast(result.error, "error");
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

  const sheetDeal = sheetDealId !== null
    ? deals.find((d) => d.id === sheetDealId)
    : null;

  return (
    <div className="@container">
      {/* ── Phone view (container < 640px) ──────────────────────────────── */}
      <div className="@[640px]:hidden">
        {/* Sticky segmented stage control */}
        <div className="sticky top-0 z-10 glass border-b border-[--line-1] py-2">
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
                  className={`tap flex-none whitespace-nowrap rounded-[--r-pill] px-3 text-footnote font-medium transition-colors active:scale-[0.97] ${
                    isActive
                      ? "bg-[--accent] text-[--accent-ink]"
                      : "text-[--ink-2] hover:text-[--ink-1]"
                  }`}
                >
                  {stage.label}
                  {count > 0 && (
                    <span
                      className={`ml-1.5 text-caption ${
                        isActive ? "opacity-70" : "text-[--ink-3]"
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
            <p className="py-8 text-center text-footnote text-[--ink-3]">
              No deals in this stage
            </p>
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
      <div className="hidden @[640px]:block overflow-x-auto snap-x snap-mandatory pb-4">
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
                onDrop={(id) => void handleMove(id, stage.key)}
              >
                {/* Column header */}
                <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${stage.dot}`} />
                    <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                      {stage.label}
                    </span>
                  </div>
                  <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
                    {cards.length}
                  </span>
                </div>

                {/* Stage value */}
                {stageTotal > 0 && (
                  <div className="border-b border-neutral-800 px-4 py-2">
                    <p className="text-xs text-neutral-500">
                      {fmtUSD.format(stageTotal)}
                    </p>
                  </div>
                )}

                {/* Cards */}
                <div className="flex flex-1 flex-col gap-3 p-3">
                  {cards.length === 0 ? (
                    <p className="py-6 text-center text-xs text-neutral-700">
                      No deals
                    </p>
                  ) : (
                    cards.map((deal) => (
                      <KanbanCard
                        key={deal.id}
                        deal={deal}
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
      {sheetDealId !== null && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/60"
            onClick={closeSheet}
            aria-hidden="true"
          />

          {/* Sheet */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Move deal to stage"
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-[--r-2xl] bg-[--surface-2] shadow-[--shadow-3] pb-[env(safe-area-inset-bottom)]"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="h-1 w-10 rounded-full bg-[--line-2]" />
            </div>

            <div className="px-4 pb-4">
              {sheetTerminal ? (
                /* Won / Lost reason flow */
                <div className="space-y-3">
                  <p className="text-body font-semibold text-[--ink-1]">
                    Reason for{" "}
                    <span
                      className={
                        sheetTerminal === "won" ? "text-[--ok]" : "text-[--bad]"
                      }
                    >
                      {sheetTerminal === "won" ? "Won" : "Lost"}
                    </span>
                    <span className="text-footnote font-normal text-[--ink-3]">
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
                    className="tap w-full rounded-[--r-md] border border-[--line-1] bg-[--surface-1] px-3 text-body text-[--ink-1] placeholder-[--ink-3] focus:border-[--line-2] focus:outline-none [color-scheme:dark]"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={confirmSheetTerminal}
                      className={`tap flex-1 rounded-[--r-md] px-4 text-body font-medium transition-colors ${
                        sheetTerminal === "won"
                          ? "bg-[--ok-tint] text-[--ok] hover:bg-[--ok]/25"
                          : "bg-[--bad-tint] text-[--bad] hover:bg-[--bad]/25"
                      }`}
                    >
                      Confirm {sheetTerminal === "won" ? "Won" : "Lost"}
                    </button>
                    <button
                      type="button"
                      onClick={closeSheet}
                      className="tap rounded-[--r-md] border border-[--line-1] px-4 text-body text-[--ink-2] transition-colors hover:text-[--ink-1]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* Stage picker list */
                <div>
                  <p className="mb-2 text-caption uppercase tracking-wider text-[--ink-3]">
                    Move to stage
                  </p>
                  <div className="flex flex-col divide-y divide-[--line-1]">
                    {STAGES.map((stage) => {
                      const isCurrent = sheetDeal?.stage === stage.key;
                      return (
                        <button
                          key={stage.key}
                          type="button"
                          onClick={() => handleSheetPick(stage.key)}
                          disabled={isCurrent}
                          className="tap flex items-center gap-3 px-1 text-left text-body text-[--ink-1] transition-colors hover:text-[--accent] disabled:opacity-40 active:scale-[0.98]"
                        >
                          <span
                            className={`h-2.5 w-2.5 shrink-0 rounded-full ${stage.dot}`}
                          />
                          <span className="flex-1">{stage.label}</span>
                          {isCurrent && (
                            <span className="text-caption text-[--ink-3]">
                              Current
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
