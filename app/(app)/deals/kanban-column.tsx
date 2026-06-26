"use client";

import { useState } from "react";

export default function KanbanColumn({
  stageKey,
  onDrop,
  children,
}: {
  stageKey: string;
  onDrop: (dealId: number) => void;
  children: React.ReactNode;
}) {
  const [over, setOver] = useState(false);

  return (
    <div
      className={`flex w-[min(80vw,320px)] flex-none snap-start flex-col rounded-xl border transition-colors ${
        over
          ? "border-[--accent]/40 bg-[--accent-tint]"
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
        const raw = e.dataTransfer.getData("dealId");
        if (!raw) return;
        const id = parseInt(raw, 10);
        if (!isNaN(id)) onDrop(id);
      }}
    >
      {children}
    </div>
  );
}
