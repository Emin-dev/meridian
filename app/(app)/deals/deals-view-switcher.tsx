"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "deals-view";
type View = "kanban" | "table";

export function DealsViewSwitcher({
  currentView,
  ownerParam,
  stageParam,
}: {
  currentView: View;
  ownerParam?: string;
  stageParam?: string;
}) {
  const router = useRouter();

  function buildQuery(view: View) {
    const params = new URLSearchParams();
    params.set("view", view);
    if (ownerParam) params.set("owner", ownerParam);
    if (stageParam) params.set("stage", stageParam);
    return params.toString();
  }

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as View | null;
    // Match the lg breakpoint where the toggle hides and cards take over, so
    // every < lg viewport lands on the cards (table) view.
    const isMobile = window.innerWidth < 1024;

    let preferred: View | null = null;
    if (saved) {
      preferred = saved;
    } else if (isMobile) {
      preferred = "table";
      localStorage.setItem(STORAGE_KEY, "table");
    }

    if (preferred && preferred !== currentView) {
      router.replace(`?${buildQuery(preferred)}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setView(view: View) {
    localStorage.setItem(STORAGE_KEY, view);
    router.push(`?${buildQuery(view)}`);
  }

  const isTable = currentView === "table";

  return (
    <div className="hidden items-center rounded-lg border border-[var(--line-1)] bg-[var(--surface-1)] p-0.5 lg:flex">
      <button
        onClick={() => setView("kanban")}
        className={`flex min-h-[44px] items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
          !isTable
            ? "bg-[var(--surface-2)] text-[var(--ink-1)]"
            : "text-[var(--ink-2)] hover:text-[var(--ink-1)]"
        }`}
        aria-label="Kanban view"
        aria-pressed={!isTable}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <rect x="1" y="1" width="3" height="12" rx="1" fill="currentColor" opacity="0.9" />
          <rect x="5.5" y="1" width="3" height="8" rx="1" fill="currentColor" opacity="0.9" />
          <rect x="10" y="1" width="3" height="10" rx="1" fill="currentColor" opacity="0.9" />
        </svg>
        <span className="hidden sm:inline">Kanban</span>
      </button>
      <button
        onClick={() => setView("table")}
        className={`flex min-h-[44px] items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
          isTable
            ? "bg-[var(--surface-2)] text-[var(--ink-1)]"
            : "text-[var(--ink-2)] hover:text-[var(--ink-1)]"
        }`}
        aria-label="Table view"
        aria-pressed={isTable}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <rect x="1" y="1" width="12" height="3" rx="1" fill="currentColor" opacity="0.9" />
          <rect x="1" y="5.5" width="12" height="2" rx="0.5" fill="currentColor" opacity="0.6" />
          <rect x="1" y="9" width="12" height="2" rx="0.5" fill="currentColor" opacity="0.6" />
          <rect x="1" y="12" width="12" height="1" rx="0.5" fill="currentColor" opacity="0.4" />
        </svg>
        <span className="hidden sm:inline">Table</span>
      </button>
    </div>
  );
}
