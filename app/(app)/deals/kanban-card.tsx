"use client";

import Link from "next/link";
import { useState } from "react";
import type { DealListItem } from "./types";
import { STAGES, type StageKey } from "./stages";
import { formatCurrency } from "@/lib/format";

type StageValue = StageKey;

function formatValue(value: string | null, currency: string) {
  if (!value) return null;
  const num = parseFloat(value);
  if (isNaN(num)) return null;
  return formatCurrency(num, currency);
}

function ageBadgeClass(days: number): string {
  if (days <= 14) return "bg-[var(--surface-2)] text-[var(--ink-2)]";
  if (days <= 30) return "bg-[var(--warn-tint)] text-[var(--warn)]";
  return "bg-[var(--bad-tint)] text-[var(--bad)]";
}

export default function KanbanCard({
  deal,
  onMove,
  onMoveRequest,
  phoneMode = false,
  dragDisabled = false,
  saving = false,
}: {
  deal: DealListItem;
  onMove: (dealId: number, stage: string, reason?: string) => void;
  onMoveRequest?: (dealId: number) => void;
  phoneMode?: boolean;
  dragDisabled?: boolean;
  saving?: boolean;
}) {
  const [pendingTerminal, setPendingTerminal] = useState<StageValue | null>(null);
  const [reason, setReason] = useState("");

  const draggable = !phoneMode && !dragDisabled;

  const formatted = formatValue(deal.value, deal.currency);
  const ageDays = Math.floor(
    (Date.now() - new Date(deal.createdAt).getTime()) / 86_400_000
  );

  function handleStageChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStage = e.target.value as StageValue;
    if (newStage === "won" || newStage === "lost") {
      setPendingTerminal(newStage);
      setReason("");
    } else {
      onMove(deal.id, newStage);
    }
  }

  function confirmTerminal() {
    if (!pendingTerminal) return;
    const stage = pendingTerminal;
    const r = reason;
    setPendingTerminal(null);
    setReason("");
    onMove(deal.id, stage, r);
  }

  // While the board persists this card's stage move, show a subtle pending cue
  // and freeze interaction so the in-flight card reads as "saving" until the
  // server reconciles (or the optimistic move rolls back). Pulse is motion-safe.
  const savingClass = saving
    ? " opacity-60 motion-safe:animate-pulse pointer-events-none select-none"
    : "";

  return (
    <div
      draggable={draggable && !saving}
      aria-busy={saving}
      onDragStart={(e) => {
        if (!draggable || saving) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("dealId", String(deal.id));
      }}
      className={
        (phoneMode
          ? "press rounded-[var(--r-lg)] border border-[var(--line-1)] bg-[var(--surface-1)]"
          : `rounded-lg border border-[var(--line-1)] bg-[var(--surface-1)] transition-colors hover:border-[var(--line-2)] hover:bg-[var(--surface-2)] ${
              dragDisabled ? "cursor-default" : "cursor-grab active:cursor-grabbing"
            }`) + savingClass
      }
    >
      {/* Clickable card body → deal detail */}
      <Link href={`/deals/${deal.id}`} className="block p-3" draggable={false}>
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 break-words text-sm font-medium text-[var(--ink-1)] leading-snug">
            {deal.title}
          </p>
          <span
            className={`shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${ageBadgeClass(
              ageDays
            )}`}
          >
            {ageDays}d
          </span>
        </div>

        {formatted ? (
          <p className="mt-1 text-sm font-semibold text-[var(--accent-text)]">
            {formatted}
          </p>
        ) : (
          <p className="mt-1 text-sm font-semibold text-[var(--ink-3)]">—</p>
        )}

        {deal.contact && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--ink-3)]">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--surface-3)] text-[10px] font-medium text-[var(--ink-2)]">
              {(deal.contact.name[0] ?? "?").toUpperCase()}
            </span>
            <span className="min-w-0 truncate">{deal.contact.name}</span>
          </div>
        )}

        {deal.owner && (
          <div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--ink-3)]">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </span>
            <span className="min-w-0 truncate">{deal.owner}</span>
          </div>
        )}
      </Link>

      {/* Stage controls — outside the link */}
      <div className="border-t border-[var(--line-1)] px-3 pb-3 pt-2">
        {phoneMode ? (
          /* Phone mode: button that opens the board's bottom sheet */
          <button
            type="button"
            onClick={() => onMoveRequest?.(deal.id)}
            className="tap flex w-full items-center justify-between rounded-[var(--r-md)] border border-[var(--line-1)] bg-[var(--surface-2)] px-3 text-left text-footnote text-[var(--ink-2)] transition-colors hover:text-[var(--ink-1)]"
          >
            <span>Move stage</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        ) : pendingTerminal ? (
          <div className="space-y-1.5">
            <p className="text-[11px] text-[var(--ink-2)]">
              Reason for{" "}
              <span
                className={
                  pendingTerminal === "won" ? "text-[var(--ok)]" : "text-[var(--bad)]"
                }
              >
                {pendingTerminal === "won" ? "Won" : "Lost"}
              </span>{" "}
              <span className="text-[var(--ink-3)]">(optional)</span>
            </p>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                pendingTerminal === "lost"
                  ? "e.g. Price, competitor…"
                  : "e.g. Contract signed…"
              }
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmTerminal();
                if (e.key === "Escape") {
                  setPendingTerminal(null);
                  setReason("");
                }
              }}
              className="w-full rounded border border-[var(--line-1)] bg-[var(--surface-2)] px-2 py-1 text-xs text-[var(--ink-1)] placeholder:text-[var(--ink-3)] focus:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2"
            />
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={confirmTerminal}
                className={`tap flex-1 inline-flex min-h-[44px] items-center justify-center rounded px-3 text-[11px] font-medium transition-colors ${
                  pendingTerminal === "won"
                    ? "bg-[var(--ok-tint)] hover:opacity-80 text-[var(--ok)]"
                    : "bg-[var(--bad-tint)] hover:opacity-80 text-[var(--bad)]"
                }`}
              >
                Confirm {pendingTerminal === "won" ? "Won" : "Lost"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingTerminal(null);
                  setReason("");
                }}
                className="tap inline-flex min-h-[44px] items-center justify-center rounded px-3 text-[11px] text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink-1)] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <select
            value={deal.stage}
            onChange={handleStageChange}
            className="min-h-[44px] w-full rounded border border-[var(--line-1)] bg-[var(--surface-2)] px-2 py-1 text-xs text-[var(--ink-2)] focus:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2 cursor-pointer"
            aria-label="Move to stage"
          >
            {STAGES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
