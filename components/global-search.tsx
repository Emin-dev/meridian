"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { searchGlobal, type SearchResults } from "@/app/(app)/search/actions";
import { SearchIcon, DollarSignIcon, ClockIcon } from "@/components/icons";
import { useOverlayDismiss } from "@/hooks/use-overlay-dismiss";

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
  // Whether a database is configured. When false, searchGlobal can only ever
  // return empty results, so the overlay shows a "connect the database" state
  // (matching the /search page) instead of a misleading "No results".
  dbConnected?: boolean;
}

type FlatItem =
  | { kind: "contact"; id: number; href: string }
  | { kind: "deal"; id: number; href: string }
  | { kind: "activity"; id: number; href: string }
  | { kind: "see-all"; category: "contacts" | "deals" | "activities"; href: string };

export function GlobalSearch({ open, onClose, dbConnected = true }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Monotonic id for the in-flight search so out-of-order responses are dropped.
  const requestIdRef = useRef(0);
  const router = useRouter();
  const panelRef = useOverlayDismiss<HTMLDivElement>(open, onClose);

  // Focus input on open; reset state on close
  useEffect(() => {
    if (open) {
      // ⌘K can fire over an open native <dialog>; never stack overlays.
      document
        .querySelectorAll("dialog[open]")
        .forEach((d) => (d as HTMLDialogElement).close());
      const t = setTimeout(() => inputRef.current?.focus(), 10);
      return () => clearTimeout(t);
    } else {
      setQuery("");
      setResults(null);
      setSelectedIndex(0);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    // Mirror the server's querySchema.min(2) guard: a 0–1 char term can only
    // ever return EMPTY_RESULTS, so skip the round-trip and stay in the prompt
    // state instead of flashing a misleading "No results". Also invalidate any
    // in-flight request so a late response can't repopulate a cleared input.
    if (query.trim().length < 2) {
      requestIdRef.current++;
      setResults(null);
      setSelectedIndex(0);
      return;
    }
    // No database: searchGlobal returns empty regardless, so don't waste a
    // round-trip — the render shows the "connect the database" state.
    if (!dbConnected) {
      requestIdRef.current++;
      setResults(null);
      setSelectedIndex(0);
      return;
    }
    const t = setTimeout(() => {
      const requestId = ++requestIdRef.current;
      startTransition(async () => {
        const res = await searchGlobal(query);
        // Drop stale responses that resolve out of order behind a newer query.
        if (requestId !== requestIdRef.current) return;
        setResults(res);
        setSelectedIndex(0);
      });
    }, 300);
    return () => clearTimeout(t);
  }, [query, dbConnected]);

  // Scroll selected item into view when selection changes via keyboard
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-search-idx="${selectedIndex}"]`
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const encodedQ = encodeURIComponent(query);

  // Flat list for keyboard navigation — order must match JSX rendering order
  const allItems: FlatItem[] = [];
  if (results) {
    for (const c of results.contacts) {
      allItems.push({ kind: "contact", id: c.id, href: `/contacts/${c.id}` });
    }
    if (results.hasMore.contacts) {
      allItems.push({ kind: "see-all", category: "contacts", href: `/search?q=${encodedQ}&tab=contacts` });
    }
    for (const d of results.deals) {
      allItems.push({ kind: "deal", id: d.id, href: `/deals/${d.id}` });
    }
    if (results.hasMore.deals) {
      allItems.push({ kind: "see-all", category: "deals", href: `/search?q=${encodedQ}&tab=deals` });
    }
    for (const a of results.activities) {
      allItems.push({ kind: "activity", id: a.id, href: `/activity` });
    }
    if (results.hasMore.activities) {
      allItems.push({ kind: "see-all", category: "activities", href: `/search?q=${encodedQ}&tab=activities` });
    }
  }

  function navigate(href: string) {
    router.push(href);
    onClose();
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "Escape":
        onClose();
        break;
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((i) => Math.max(0, Math.min(i + 1, allItems.length - 1)));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (allItems[selectedIndex]) {
          navigate(allItems[selectedIndex].href);
        } else if (query.trim()) {
          // No row selected yet (results still loading, or zero matches): fall
          // through to the full search page instead of dead-ending on Enter.
          navigate(`/search?q=${encodedQ}`);
        }
        break;
    }
  }

  if (!open) return null;

  // Index helpers — keep in sync with allItems construction above
  function idxForContact(id: number) {
    return allItems.findIndex((i) => i.kind === "contact" && i.id === id);
  }
  function idxForDeal(id: number) {
    return allItems.findIndex((i) => i.kind === "deal" && i.id === id);
  }
  function idxForActivity(id: number) {
    return allItems.findIndex((i) => i.kind === "activity" && i.id === id);
  }
  function idxForSeeAll(category: "contacts" | "deals" | "activities") {
    return allItems.findIndex((i) => i.kind === "see-all" && i.category === category);
  }

  return (
    /* Backdrop — bottom-sheet on mobile, centered card on desktop */
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm sm:items-start sm:justify-center sm:pt-[15vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Global search"
        className="[color-scheme:dark] flex w-full flex-col max-h-[85dvh] overflow-hidden rounded-t-[var(--r-2xl)] border border-[var(--line-1)] bg-[var(--surface-1)] shadow-[var(--shadow-3)] sm:mx-4 sm:max-w-lg sm:rounded-[var(--r-xl)]"
      >
        {/* Input row — 44px touch target */}
        <div className="tap flex items-center gap-3 border-b border-[var(--line-1)] px-4">
          <SearchIcon size={16} className="shrink-0 text-[var(--ink-3)]" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search contacts, deals and activities…"
            className="flex-1 bg-transparent text-body text-[var(--ink-1)] placeholder:text-[var(--ink-3)] outline-none"
            aria-label="Global search"
          />
          {isPending && (
            <>
              <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" aria-hidden="true" />
              <span role="status" className="sr-only">Searching…</span>
            </>
          )}
          {/* Desktop advertises Esc; touch gets a tappable close (Esc is unreachable on mobile). */}
          <kbd className="hidden shrink-0 rounded border border-[var(--line-1)] px-1.5 py-0.5 font-mono text-caption text-[var(--ink-3)] sm:inline-block">
            Esc
          </kbd>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="tap -mr-2 flex shrink-0 items-center justify-center text-[var(--ink-3)] transition-colors hover:text-[var(--ink-1)] sm:hidden"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Results list — scrollable */}
        <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto" role="listbox" aria-label="Search results">
          {!dbConnected && query.trim().length >= 2 ? (
            <div role="status" className="px-6 py-8 text-center">
              <p className="text-body text-[var(--ink-2)]">Database not connected.</p>
              <p className="mt-1 text-footnote text-[var(--ink-3)]">
                Set DATABASE_URL to enable search.
              </p>
            </div>
          ) : !results ? (
            <p role="status" className="py-8 text-center text-body text-[var(--ink-3)]">
              Type to search contacts, deals and activities
            </p>
          ) : allItems.length === 0 ? (
            <p role="status" className="py-8 text-center text-body text-[var(--ink-3)]">
              No results for &ldquo;{query}&rdquo;
            </p>
          ) : null}

          {/* Contacts section */}
          {results && results.contacts.length > 0 && (
            <div className="p-2">
              <p className="mb-1 px-2 text-caption font-semibold uppercase tracking-wider text-[var(--ink-3)]">
                Contacts
              </p>
              {results.contacts.map((contact) => {
                const flatIdx = idxForContact(contact.id);
                const active = flatIdx === selectedIndex;
                return (
                  <button
                    key={contact.id}
                    data-search-idx={flatIdx}
                    onClick={() => navigate(`/contacts/${contact.id}`)}
                    onMouseEnter={() => setSelectedIndex(flatIdx)}
                    role="option"
                    aria-selected={active}
                    className={[
                      "tap flex w-full items-center gap-3 rounded-[var(--r-md)] px-3 text-left text-body transition-colors",
                      active
                        ? "bg-[var(--accent)] text-[var(--accent-ink)]"
                        : "text-[var(--ink-1)] hover:bg-[var(--surface-2)]",
                    ].join(" ")}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-footnote font-medium">
                      {contact.name[0]?.toUpperCase() ?? "?"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{contact.name}</span>
                      {(contact.company || contact.email) && (
                        <span className={["block truncate text-footnote", active ? "opacity-70" : "text-[var(--ink-3)]"].join(" ")}>
                          {contact.company || contact.email}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
              {results.hasMore.contacts && (() => {
                const flatIdx = idxForSeeAll("contacts");
                const active = flatIdx === selectedIndex;
                return (
                  <button
                    data-search-idx={flatIdx}
                    onClick={() => navigate(`/search?q=${encodedQ}&tab=contacts`)}
                    onMouseEnter={() => setSelectedIndex(flatIdx)}
                    role="option"
                    aria-selected={active}
                    className={[
                      "tap flex w-full items-center gap-2 rounded-[var(--r-md)] px-3 text-left text-footnote transition-colors",
                      active ? "bg-[var(--accent)] text-[var(--accent-ink)]" : "text-[var(--accent-text)] hover:bg-[var(--surface-2)]",
                    ].join(" ")}
                  >
                    <SearchIcon size={12} className="shrink-0" aria-hidden="true" />
                    See all contacts
                  </button>
                );
              })()}
            </div>
          )}

          {/* Deals section */}
          {results && results.deals.length > 0 && (
            <div className="p-2">
              <p className="mb-1 px-2 text-caption font-semibold uppercase tracking-wider text-[var(--ink-3)]">
                Deals
              </p>
              {results.deals.map((deal) => {
                const flatIdx = idxForDeal(deal.id);
                const active = flatIdx === selectedIndex;
                return (
                  <button
                    key={deal.id}
                    data-search-idx={flatIdx}
                    onClick={() => navigate(`/deals/${deal.id}`)}
                    onMouseEnter={() => setSelectedIndex(flatIdx)}
                    role="option"
                    aria-selected={active}
                    className={[
                      "tap flex w-full items-center gap-3 rounded-[var(--r-md)] px-3 text-left text-body transition-colors",
                      active ? "bg-[var(--accent)] text-[var(--accent-ink)]" : "text-[var(--ink-1)] hover:bg-[var(--surface-2)]",
                    ].join(" ")}
                  >
                    <span className={["flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--ink-2)]", active ? "bg-[var(--accent-hover)]" : "bg-[var(--surface-2)]"].join(" ")}>
                      <DollarSignIcon size={12} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{deal.title}</span>
                      <span className={["block truncate text-footnote capitalize", active ? "opacity-70" : "text-[var(--ink-3)]"].join(" ")}>
                        {deal.stage}
                      </span>
                    </span>
                    {deal.value && (
                      <span className={["shrink-0 text-footnote", active ? "opacity-80" : "text-[var(--ink-2)]"].join(" ")}>
                        ${Number(deal.value).toLocaleString()}
                      </span>
                    )}
                  </button>
                );
              })}
              {results.hasMore.deals && (() => {
                const flatIdx = idxForSeeAll("deals");
                const active = flatIdx === selectedIndex;
                return (
                  <button
                    data-search-idx={flatIdx}
                    onClick={() => navigate(`/search?q=${encodedQ}&tab=deals`)}
                    onMouseEnter={() => setSelectedIndex(flatIdx)}
                    role="option"
                    aria-selected={active}
                    className={[
                      "tap flex w-full items-center gap-2 rounded-[var(--r-md)] px-3 text-left text-footnote transition-colors",
                      active ? "bg-[var(--accent)] text-[var(--accent-ink)]" : "text-[var(--accent-text)] hover:bg-[var(--surface-2)]",
                    ].join(" ")}
                  >
                    <SearchIcon size={12} className="shrink-0" aria-hidden="true" />
                    See all deals
                  </button>
                );
              })()}
            </div>
          )}

          {/* Activities section */}
          {results && results.activities.length > 0 && (
            <div className="p-2">
              <p className="mb-1 px-2 text-caption font-semibold uppercase tracking-wider text-[var(--ink-3)]">
                Activities
              </p>
              {results.activities.map((activity) => {
                const flatIdx = idxForActivity(activity.id);
                const active = flatIdx === selectedIndex;
                return (
                  <button
                    key={activity.id}
                    data-search-idx={flatIdx}
                    onClick={() => navigate(`/activity`)}
                    onMouseEnter={() => setSelectedIndex(flatIdx)}
                    role="option"
                    aria-selected={active}
                    className={[
                      "tap flex w-full items-center gap-3 rounded-[var(--r-md)] px-3 text-left text-body transition-colors",
                      active ? "bg-[var(--accent)] text-[var(--accent-ink)]" : "text-[var(--ink-1)] hover:bg-[var(--surface-2)]",
                    ].join(" ")}
                  >
                    <span className={["flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--ink-2)]", active ? "bg-[var(--accent-hover)]" : "bg-[var(--surface-2)]"].join(" ")}>
                      <ClockIcon size={12} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{activity.subject}</span>
                      {activity.body && (
                        <span className={["block truncate text-footnote", active ? "opacity-70" : "text-[var(--ink-3)]"].join(" ")}>
                          {activity.body}
                        </span>
                      )}
                    </span>
                    <span className={["shrink-0 rounded-[var(--r-sm)] px-1.5 py-0.5 text-caption font-medium capitalize", active ? "bg-[var(--accent-hover)] text-[var(--accent-ink)]" : "bg-[var(--surface-3)] text-[var(--ink-2)]"].join(" ")}>
                      {activity.type}
                    </span>
                  </button>
                );
              })}
              {results.hasMore.activities && (() => {
                const flatIdx = idxForSeeAll("activities");
                const active = flatIdx === selectedIndex;
                return (
                  <button
                    data-search-idx={flatIdx}
                    onClick={() => navigate(`/search?q=${encodedQ}&tab=activities`)}
                    onMouseEnter={() => setSelectedIndex(flatIdx)}
                    role="option"
                    aria-selected={active}
                    className={[
                      "tap flex w-full items-center gap-2 rounded-[var(--r-md)] px-3 text-left text-footnote transition-colors",
                      active ? "bg-[var(--accent)] text-[var(--accent-ink)]" : "text-[var(--accent-text)] hover:bg-[var(--surface-2)]",
                    ].join(" ")}
                  >
                    <SearchIcon size={12} className="shrink-0" aria-hidden="true" />
                    See all activities
                  </button>
                );
              })()}
            </div>
          )}
        </div>

        {/* Footer hints */}
        <div
          className="flex items-center justify-end gap-4 border-t border-[var(--line-1)] px-4 py-2"
          style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
        >
          <span className="text-caption text-[var(--ink-3)]">
            <kbd className="mr-1 rounded border border-[var(--line-1)] px-1 font-mono text-caption">↑↓</kbd>
            navigate
          </span>
          <span className="text-caption text-[var(--ink-3)]">
            <kbd className="mr-1 rounded border border-[var(--line-1)] px-1 font-mono text-caption">↵</kbd>
            select
          </span>
        </div>
      </div>
    </div>
  );
}
