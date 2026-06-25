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

  return (
    <div className="@container">
      <div className="overflow-x-auto snap-x snap-mandatory pb-4">
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
    </div>
  );
}
