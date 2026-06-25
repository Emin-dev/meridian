"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { searchGlobal, type SearchResults } from "@/app/(app)/search/actions";

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Focus input on open; reset state on close
  useEffect(() => {
    if (open) {
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
    if (!query.trim()) {
      setResults(null);
      setSelectedIndex(0);
      return;
    }
    const t = setTimeout(() => {
      startTransition(async () => {
        const res = await searchGlobal(query);
        setResults(res);
        setSelectedIndex(0);
      });
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  // Flat list for arrow-key navigation
  const allItems = [
    ...(results?.contacts.map((c) => ({
      type: "contact" as const,
      id: c.id,
      href: `/contacts/${c.id}`,
    })) ?? []),
    ...(results?.deals.map((d) => ({
      type: "deal" as const,
      id: d.id,
      href: `/deals/${d.id}`,
    })) ?? []),
  ];

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
        setSelectedIndex((i) => Math.min(i + 1, allItems.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        if (allItems[selectedIndex]) navigate(allItems[selectedIndex].href);
        break;
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mx-4 w-full max-w-lg overflow-hidden rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl">
        {/* Input row */}
        <div className="flex items-center gap-3 border-b border-neutral-800 px-4 py-3">
          <svg
            className="shrink-0 text-neutral-500"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search contacts and deals…"
            className="flex-1 bg-transparent text-sm text-neutral-100 placeholder:text-neutral-500 outline-none"
          />
          {isPending && (
            <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          )}
          <kbd className="shrink-0 rounded border border-neutral-700 px-1.5 py-0.5 font-mono text-xs text-neutral-600">
            Esc
          </kbd>
        </div>

        {/* Results list */}
        <div className="max-h-80 overflow-y-auto">
          {!results && (
            <p className="py-8 text-center text-sm text-neutral-500">
              Type to search contacts and deals
            </p>
          )}

          {results && allItems.length === 0 && (
            <p className="py-8 text-center text-sm text-neutral-500">
              No results for &ldquo;{query}&rdquo;
            </p>
          )}

          {results && results.contacts.length > 0 && (
            <div className="p-2">
              <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Contacts
              </p>
              {results.contacts.map((contact) => {
                const flatIdx = allItems.findIndex(
                  (i) => i.type === "contact" && i.id === contact.id
                );
                const active = flatIdx === selectedIndex;
                return (
                  <button
                    key={contact.id}
                    onClick={() => navigate(`/contacts/${contact.id}`)}
                    onMouseEnter={() => setSelectedIndex(flatIdx)}
                    className={[
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                      active
                        ? "bg-indigo-600 text-white"
                        : "text-neutral-200 hover:bg-neutral-800",
                    ].join(" ")}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-700 text-xs font-medium">
                      {contact.name[0]?.toUpperCase() ?? "?"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{contact.name}</span>
                      {(contact.company || contact.email) && (
                        <span
                          className={[
                            "block truncate text-xs",
                            active ? "text-indigo-200" : "text-neutral-500",
                          ].join(" ")}
                        >
                          {contact.company || contact.email}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {results && results.deals.length > 0 && (
            <div className="p-2">
              <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Deals
              </p>
              {results.deals.map((deal) => {
                const flatIdx = allItems.findIndex(
                  (i) => i.type === "deal" && i.id === deal.id
                );
                const active = flatIdx === selectedIndex;
                return (
                  <button
                    key={deal.id}
                    onClick={() => navigate(`/deals/${deal.id}`)}
                    onMouseEnter={() => setSelectedIndex(flatIdx)}
                    className={[
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                      active
                        ? "bg-indigo-600 text-white"
                        : "text-neutral-200 hover:bg-neutral-800",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-neutral-400",
                        active ? "bg-indigo-500" : "bg-neutral-800",
                      ].join(" ")}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="12" x2="12" y1="2" y2="22" />
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                      </svg>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{deal.title}</span>
                      <span
                        className={[
                          "block truncate text-xs capitalize",
                          active ? "text-indigo-200" : "text-neutral-500",
                        ].join(" ")}
                      >
                        {deal.stage}
                      </span>
                    </span>
                    {deal.value && (
                      <span
                        className={[
                          "shrink-0 text-xs",
                          active ? "text-indigo-200" : "text-neutral-400",
                        ].join(" ")}
                      >
                        ${Number(deal.value).toLocaleString()}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center justify-end gap-4 border-t border-neutral-800 px-4 py-2">
          <span className="text-xs text-neutral-600">
            <kbd className="mr-1 rounded border border-neutral-700 px-1 font-mono text-xs">↑↓</kbd>
            navigate
          </span>
          <span className="text-xs text-neutral-600">
            <kbd className="mr-1 rounded border border-neutral-700 px-1 font-mono text-xs">↵</kbd>
            select
          </span>
        </div>
      </div>
    </div>
  );
}
