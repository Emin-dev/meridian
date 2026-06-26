"use client";

import { useRef } from "react";
import Link from "next/link";

type SequenceTab = "steps" | "contacts" | "preview";

const TABS: { key: SequenceTab; label: string }[] = [
  { key: "steps", label: "Steps" },
  { key: "contacts", label: "Enrolled Contacts" },
  { key: "preview", label: "Preview" },
];

interface Props {
  numId: number;
  activeTab: SequenceTab;
  enrollmentCount: number;
}

export function SequenceTabs({ numId, activeTab, enrollmentCount }: Props) {
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  function hrefFor(key: SequenceTab) {
    return key === "steps" ? `/sequences/${numId}` : `/sequences/${numId}?tab=${key}`;
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLAnchorElement>, index: number) {
    let next = index;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      next = (index + 1) % TABS.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      next = (index - 1 + TABS.length) % TABS.length;
    } else if (e.key === "Home") {
      next = 0;
    } else if (e.key === "End") {
      next = TABS.length - 1;
    } else {
      return;
    }
    e.preventDefault();
    tabRefs.current[next]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label="Sequence sections"
      className="flex overflow-x-auto border-b border-[var(--line-1)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {TABS.map((tab, index) => {
        const isActive = activeTab === tab.key;
        return (
          <Link
            key={tab.key}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            href={hrefFor(tab.key)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`-mb-px shrink-0 whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "border-b-2 border-[var(--accent)] text-[var(--ink-1)]"
                : "text-[var(--ink-2)] hover:text-[var(--ink-1)]"
            }`}
          >
            {tab.label}
            {tab.key === "contacts" && enrollmentCount > 0 && (
              <span className="ml-1.5 rounded-full bg-[var(--surface-2)] px-1.5 py-0.5 text-xs font-normal text-[var(--ink-2)]">
                {enrollmentCount}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
