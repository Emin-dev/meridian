"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "contacts-view";
export type ContactsView = "cards" | "table";

export function ContactsViewSwitcher({
  currentView,
  allSearchParams,
}: {
  currentView: ContactsView;
  allSearchParams: Record<string, string>;
}) {
  const router = useRouter();

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ContactsView | null;
    const isMobile = window.innerWidth < 768;

    let preferred: ContactsView | null = null;
    if (saved) {
      preferred = saved;
    } else if (isMobile) {
      preferred = "cards";
      localStorage.setItem(STORAGE_KEY, "cards");
    }

    if (preferred && preferred !== currentView) {
      const params = new URLSearchParams(allSearchParams);
      params.set("view", preferred);
      router.replace(`?${params.toString()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setView(view: ContactsView) {
    localStorage.setItem(STORAGE_KEY, view);
    const params = new URLSearchParams(allSearchParams);
    params.set("view", view);
    router.push(`?${params.toString()}`);
  }

  const isCards = currentView === "cards";

  return (
    <div className="flex items-center rounded-lg border border-[var(--line-1)] bg-[var(--surface-1)] p-0.5">
      <button
        onClick={() => setView("cards")}
        className={`flex min-h-[44px] items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors sm:min-h-0 sm:py-1.5 ${
          isCards
            ? "bg-[var(--surface-2)] text-[var(--ink-1)]"
            : "text-[var(--ink-2)] hover:text-[var(--ink-1)]"
        }`}
        aria-label="Card view"
        aria-pressed={isCards}
      >
        {/* Grouped-list icon */}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <rect x="1" y="1.5" width="3" height="2.5" rx="0.5" fill="currentColor" />
          <rect x="5.5" y="2.25" width="7.5" height="1.5" rx="0.5" fill="currentColor" opacity="0.7" />
          <rect x="1" y="5.75" width="3" height="2.5" rx="0.5" fill="currentColor" />
          <rect x="5.5" y="6.5" width="7.5" height="1.5" rx="0.5" fill="currentColor" opacity="0.7" />
          <rect x="1" y="10" width="3" height="2.5" rx="0.5" fill="currentColor" />
          <rect x="5.5" y="10.75" width="7.5" height="1.5" rx="0.5" fill="currentColor" opacity="0.7" />
        </svg>
        <span className="hidden sm:inline">Cards</span>
      </button>
      <button
        onClick={() => setView("table")}
        className={`flex min-h-[44px] items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors sm:min-h-0 sm:py-1.5 ${
          !isCards
            ? "bg-[var(--surface-2)] text-[var(--ink-1)]"
            : "text-[var(--ink-2)] hover:text-[var(--ink-1)]"
        }`}
        aria-label="Table view"
        aria-pressed={!isCards}
      >
        {/* Table icon */}
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
