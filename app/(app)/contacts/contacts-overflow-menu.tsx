"use client";

import { useState } from "react";

import MobileActionSheet from "@/components/mobile-action-sheet";
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
  unscored?: string;
  noActivity?: string;
}

export default function ContactsOverflowMenu({
  hasUnscored,
  hasDb,
  status,
  company,
  minScore,
  source,
  tag,
  unscored,
  noActivity,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative sm:hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="More actions"
        aria-expanded={open}
        className="tap flex items-center justify-center rounded-lg border border-[--line-1] bg-[--surface-2] px-3 text-sm text-[--ink-2] transition-colors hover:bg-[--surface-3] hover:text-[--ink-1]"
      >
        •••
      </button>
      <MobileActionSheet open={open} onClose={() => setOpen(false)} title="More actions">
        <div className="flex flex-col gap-1">
          <div className="flex min-h-[44px] w-full flex-col [&>*]:w-full">
            <ScoreAllUnscoredButton hasUnscored={hasUnscored} />
          </div>
          <div className="flex min-h-[44px] w-full flex-col [&>*]:w-full">
            <FindDuplicatesButton hasDb={hasDb} />
          </div>
          <div className="flex min-h-[44px] w-full flex-col [&>*]:w-full">
            <ExportCsvButton
              hasDb={hasDb}
              status={status}
              company={company}
              minScore={minScore}
              source={source}
              tag={tag}
              unscored={unscored}
              noActivity={noActivity}
            />
          </div>
        </div>
      </MobileActionSheet>
    </div>
  );
}
