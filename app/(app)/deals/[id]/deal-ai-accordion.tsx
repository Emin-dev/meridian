"use client";

import { useState, type ReactNode } from "react";

interface Props {
  title: string;
  children: ReactNode;
}

// On phones the deal detail page stacks many AI panels, forcing endless scroll.
// Wrap each panel in a tap-to-expand section that is collapsed by default on
// <lg. On desktop (lg+) the toggle is hidden and the body is always shown, so
// the desktop layout is unchanged. The body stays mounted in both states, so
// every panel's action state and cached AI result is preserved across toggles.
export default function DealAiAccordion({ title, children }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-[var(--line-1)] bg-[var(--surface-1)] p-4 sm:p-5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="tap -m-1 flex w-full items-center gap-3 p-1 text-left lg:hidden"
      >
        <span className="flex-1 text-sm font-medium text-[var(--ink-2)]">{title}</span>
        <span
          aria-hidden="true"
          className={`text-xs text-[var(--ink-3)] transition-transform duration-150 ${
            open ? "rotate-180" : ""
          }`}
        >
          ▾
        </span>
      </button>

      <div className={`${open ? "mt-4 block" : "hidden"} lg:mt-0 lg:block`}>
        {children}
      </div>
    </div>
  );
}
