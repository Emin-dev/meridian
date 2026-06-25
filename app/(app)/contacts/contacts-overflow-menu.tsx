"use client";

import { useState, useRef, useEffect } from "react";
import ScoreAllUnscoredButton from "./score-all-unscored-button";
import FindDuplicatesButton from "./find-duplicates-button";
import ExportCsvButton from "./export-csv-button";

interface Props {
  hasUnscored: boolean;
  hasDb: boolean;
  status?: string;
  company?: string;
  minScore?: string;
  source?: string;
  tag?: string;
}

export default function ContactsOverflowMenu({
  hasUnscored,
  hasDb,
  status,
  company,
  minScore,
  source,
  tag,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative sm:hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="More actions"
        aria-expanded={open}
        className="tap flex items-center justify-center rounded-lg border border-neutral-700 bg-neutral-800 px-3 text-sm text-neutral-300 transition-colors hover:bg-neutral-700 hover:text-neutral-100"
      >
        •••
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 flex min-w-[180px] flex-col gap-1 rounded-xl border border-neutral-700 bg-neutral-900 p-2 shadow-2xl">
          <ScoreAllUnscoredButton hasUnscored={hasUnscored} />
          <FindDuplicatesButton hasDb={hasDb} />
          <ExportCsvButton
            hasDb={hasDb}
            status={status}
            company={company}
            minScore={minScore}
            source={source}
            tag={tag}
          />
        </div>
      )}
    </div>
  );
}
