"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import MobileActionSheet from "@/components/mobile-action-sheet";

interface OwnerFilterProps {
  owners: string[];
  selected: string;
}

export default function OwnerFilter({ owners, selected }: OwnerFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sheetOpen, setSheetOpen] = useState(false);

  function selectOwner(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("owner", value);
    } else {
      params.delete("owner");
    }
    router.push(`?${params.toString()}`);
  }

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    selectOwner(e.target.value);
  }

  if (owners.length === 0) return null;

  return (
    <>
      {/* Desktop: native select */}
      <div className="hidden lg:block">
        <select
          value={selected}
          onChange={handleChange}
          className="tap rounded-lg border border-[var(--line-1)] bg-[var(--surface-1)] px-3 text-xs text-[var(--ink-2)] focus:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2"
          aria-label="Filter by owner"
        >
          <option value="">All owners</option>
          {owners.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>

      {/* Mobile: action-sheet trigger */}
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        aria-label="Filter by owner"
        className="tap lg:hidden rounded-lg border border-[var(--line-1)] bg-[var(--surface-1)] px-3 text-xs text-[var(--ink-2)] transition-colors hover:bg-[var(--surface-2)] focus:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2"
      >
        {selected || "All owners"}
      </button>

      <MobileActionSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Filter by owner"
      >
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => {
              selectOwner("");
              setSheetOpen(false);
            }}
            className={`tap flex min-h-[44px] w-full items-center rounded-lg px-3 text-sm transition-colors ${
              selected === ""
                ? "bg-[var(--surface-2)] text-[var(--ink-1)]"
                : "text-[var(--ink-2)] hover:bg-[var(--surface-2)]"
            }`}
          >
            All owners
          </button>
          {owners.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => {
                selectOwner(o);
                setSheetOpen(false);
              }}
              className={`tap flex min-h-[44px] w-full items-center rounded-lg px-3 text-sm transition-colors ${
                selected === o
                  ? "bg-[var(--surface-2)] text-[var(--ink-1)]"
                  : "text-[var(--ink-2)] hover:bg-[var(--surface-2)]"
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      </MobileActionSheet>
    </>
  );
}
