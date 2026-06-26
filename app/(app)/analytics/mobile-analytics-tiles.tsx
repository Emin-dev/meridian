"use client";

import { useState } from "react";
import type { ReactNode } from "react";

import MobileActionSheet from "@/components/mobile-action-sheet";

export type AnalyticsTile = {
  key: string;
  label: string;
  value: string;
  subtext?: string;
  sheetTitle: string;
  content: ReactNode;
};

/**
 * Mobile-only analytics surface (iOS-Weather pattern).
 *
 * Renders one calm, glanceable summary tile per analytics section with its
 * headline number; tapping a tile opens the full chart/table in a bottom
 * sheet (reusing {@link MobileActionSheet}). Server-rendered chart markup is
 * passed in as each tile's `content`, so no analytics logic is duplicated and
 * the desktop layout stays untouched. Guard this behind `lg:hidden`.
 */
export default function MobileAnalyticsTiles({
  tiles,
}: {
  tiles: AnalyticsTile[];
}) {
  const [active, setActive] = useState<string | null>(null);
  const activeTile = tiles.find((t) => t.key === active) ?? null;

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {tiles.map((tile) => (
          <button
            key={tile.key}
            type="button"
            onClick={() => setActive(tile.key)}
            className="card tap flex flex-col items-start p-3 text-left"
          >
            <span className="text-caption font-medium uppercase tracking-wide text-[var(--ink-3)]">
              {tile.label}
            </span>
            <span className="text-title3 mt-1 font-semibold text-[var(--ink-1)]">
              {tile.value}
            </span>
            {tile.subtext && (
              <span className="mt-0.5 text-footnote text-[var(--ink-3)]">
                {tile.subtext}
              </span>
            )}
          </button>
        ))}
      </div>

      <MobileActionSheet
        open={active !== null}
        onClose={() => setActive(null)}
        title={activeTile?.sheetTitle}
      >
        <div className="max-h-[75svh] overflow-y-auto">
          {activeTile?.content}
        </div>
      </MobileActionSheet>
    </>
  );
}
