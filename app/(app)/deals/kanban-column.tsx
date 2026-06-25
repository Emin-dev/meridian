"use client";

import { useState, useTransition } from "react";
import { moveDealStage } from "./actions";

export default function KanbanColumn({
  stageKey,
  children,
}: {
  stageKey: string;
  children: React.ReactNode;
}) {
  const [over, setOver] = useState(false);
  const [, startTransition] = useTransition();

  return (
    <div
      className={`flex w-60 flex-none flex-col rounded-xl border transition-colors ${
        over
          ? "border-indigo-500/40 bg-indigo-950/20"
          : "border-neutral-800 bg-neutral-900"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (!over) setOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setOver(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const id = e.dataTransfer.getData("dealId");
        if (!id) return;
        startTransition(() => {
          void moveDealStage(parseInt(id, 10), stageKey);
        });
      }}
    >
      {children}
    </div>
  );
}
