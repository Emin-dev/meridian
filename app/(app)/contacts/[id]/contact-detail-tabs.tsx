"use client";

import { useRef, useState } from "react";

const TABS = ["Overview", "AI", "Activity"] as const;
type Tab = (typeof TABS)[number];

interface Props {
  overviewPanel: React.ReactNode;
  aiPanel: React.ReactNode;
  activityPanel: React.ReactNode;
}

export default function ContactDetailTabs({ overviewPanel, aiPanel, activityPanel }: Props) {
  const [active, setActive] = useState<Tab>("Overview");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const panels: Record<Tab, React.ReactNode> = {
    Overview: overviewPanel,
    AI: aiPanel,
    Activity: activityPanel,
  };

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
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
    setActive(TABS[next]);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className="space-y-4">
      {/* Tab strip */}
      <div
        role="tablist"
        aria-label="Contact sections"
        className="flex gap-1 rounded-[14px] p-1"
        style={{ background: "var(--surface-2)" }}
      >
        {TABS.map((tab, index) => (
          <button
            key={tab}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            role="tab"
            aria-selected={active === tab}
            aria-controls={`tabpanel-${tab}`}
            id={`tab-${tab}`}
            tabIndex={active === tab ? 0 : -1}
            onClick={() => setActive(tab)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className="tap press flex-1 rounded-[10px] px-3 text-sm font-medium"
            style={
              active === tab
                ? { background: "var(--surface-3)", color: "var(--ink-1)" }
                : { color: "var(--ink-2)" }
            }
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      {TABS.map((tab) => (
        <div
          key={tab}
          id={`tabpanel-${tab}`}
          role="tabpanel"
          aria-labelledby={`tab-${tab}`}
          className={active === tab ? "space-y-4" : "hidden"}
        >
          {panels[tab]}
        </div>
      ))}
    </div>
  );
}
