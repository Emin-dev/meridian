"use client";

import Link from "next/link";
import { useState } from "react";
import type { DealWithContact } from "./types";

const STAGES = [
  { value: "lead", label: "Lead" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal", label: "Proposal" },
  { value: "negotiation", label: "Negotiation" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
] as const;

type StageValue = (typeof STAGES)[number]["value"];

function formatValue(value: string | null, currency: string) {
  if (!value) return null;
  const num = parseFloat(value);
  if (isNaN(num)) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(num);
}

function ageBadgeClass(days: number): string {
  if (days <= 14) return "bg-neutral-500/15 text-neutral-400";
  if (days <= 30) return "bg-amber-500/15 text-amber-400";
  return "bg-red-500/15 text-red-400";
}

export default function KanbanCard({
  deal,
  onMove,
  onMoveRequest,
  phoneMode = false,
}: {
  deal: DealWithContact;
  onMove: (dealId: number, stage: string, reason?: string) => void;
  onMoveRequest?: (dealId: number) => void;
  phoneMode?: boolean;
}) {
  const [pendingTerminal, setPendingTerminal] = useState<StageValue | null>(null);
  const [reason, setReason] = useState("");

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

  return (
    <div
      draggable={!phoneMode}
      onDragStart={(e) => {
        if (phoneMode) return;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("dealId", String(deal.id));
      }}
      className={
        phoneMode
          ? "press rounded-[--r-lg] border border-[--line-1] bg-[--surface-1]"
          : "rounded-lg border border-neutral-800 bg-neutral-800/50 transition-colors hover:border-neutral-700 hover:bg-neutral-800 cursor-grab active:cursor-grabbing"
      }
    >
      {/* Clickable card body → deal detail */}
      <Link href={`/deals/${deal.id}`} className="block p-3" draggable={false}>
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-neutral-100 leading-snug">
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

        {formatted && (
          <p className="mt-1 text-sm font-semibold text-[--accent]">
            {formatted}
          </p>
        )}

        {deal.contact && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-neutral-500">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-neutral-700 text-[10px] font-medium text-neutral-300">
              {(deal.contact.name[0] ?? "?").toUpperCase()}
            </span>
            <span className="truncate">{deal.contact.name}</span>
          </div>
        )}

        {deal.owner && (
          <div className="mt-1 flex items-center gap-1 text-xs text-neutral-600">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span className="truncate">{deal.owner}</span>
          </div>
        )}
      </Link>

      {/* Stage controls — outside the link */}
      <div className="border-t border-neutral-700/50 px-3 pb-3 pt-2">
        {phoneMode ? (
          /* Phone mode: button that opens the board's bottom sheet */
          <button
            type="button"
            onClick={() => onMoveRequest?.(deal.id)}
            className="tap flex w-full items-center justify-between rounded-[--r-md] border border-[--line-1] bg-[--surface-2] px-3 text-left text-footnote text-[--ink-2] transition-colors hover:text-[--ink-1]"
          >
            <span>Move stage</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        ) : pendingTerminal ? (
          <div className="space-y-1.5">
            <p className="text-[11px] text-neutral-400">
              Reason for{" "}
              <span
                className={
                  pendingTerminal === "won" ? "text-green-400" : "text-red-400"
                }
              >
                {pendingTerminal === "won" ? "Won" : "Lost"}
              </span>{" "}
              <span className="text-neutral-600">(optional)</span>
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
              className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-200 placeholder-neutral-600 focus:border-neutral-500 focus:outline-none"
            />
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={confirmTerminal}
                className={`tap flex-1 rounded px-2 text-[11px] font-medium transition-colors ${
                  pendingTerminal === "won"
                    ? "bg-green-700/70 hover:bg-green-600/80 text-green-100"
                    : "bg-red-700/70 hover:bg-red-600/80 text-red-100"
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
                className="tap rounded px-2 text-[11px] text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <select
            value={deal.stage}
            onChange={handleStageChange}
            className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-300 focus:border-neutral-500 focus:outline-none cursor-pointer"
            aria-label="Move to stage"
          >
            {STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
