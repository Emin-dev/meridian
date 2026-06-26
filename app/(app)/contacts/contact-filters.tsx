"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import MobileActionSheet from "@/components/mobile-action-sheet";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "lead", label: "Lead" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "churned", label: "Churned" },
] as const;

const SOURCE_OPTIONS = [
  { value: "", label: "All sources" },
  { value: "website", label: "Website" },
  { value: "referral", label: "Referral" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "cold-outreach", label: "Cold Outreach" },
  { value: "other", label: "Other" },
] as const;

interface Props {
  initialStatus: string;
  initialCompany: string;
  initialMinScore: string;
  initialSource: string;
  initialTag: string;
  initialSort?: string;
  initialDir?: string;
}

export default function ContactFilters({
  initialStatus,
  initialCompany,
  initialMinScore,
  initialSource,
  initialTag,
  initialSort,
  initialDir,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [status, setStatus] = useState(initialStatus);
  const [company, setCompany] = useState(initialCompany);
  const [minScore, setMinScore] = useState(initialMinScore);
  const [source, setSource] = useState(initialSource);
  const [tag, setTag] = useState(initialTag);
  const [sheetOpen, setSheetOpen] = useState(false);

  const activeCount = [status, company, minScore, source, tag].filter(
    (v) => v !== "",
  ).length;
  const hasFilters = activeCount > 0;

  function apply() {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (company.trim()) params.set("company", company.trim());
    if (minScore) params.set("minScore", minScore);
    if (source) params.set("source", source);
    if (tag.trim()) params.set("tag", tag.trim());
    if (initialSort) params.set("sort", initialSort);
    if (initialDir) params.set("dir", initialDir);
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/contacts?${qs}` : "/contacts");
    });
  }

  function clear() {
    setStatus("");
    setCompany("");
    setMinScore("");
    setSource("");
    setTag("");
    startTransition(() => {
      router.push("/contacts");
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") apply();
  }

  const inputClass =
    "tap rounded-lg border border-[--line-1] bg-[--surface-2] px-3 text-sm text-[--ink-1] placeholder-[--ink-3] focus:border-[--accent] focus:outline-none focus:ring-1 focus:ring-[--accent]";

  // Shared filter inputs, rendered both inline (desktop) and stacked (sheet).
  function fields(widths: {
    select: string;
    company: string;
    score: string;
    tag: string;
  }) {
    return (
      <>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={`${inputClass} ${widths.select}`}
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className={`${inputClass} ${widths.select}`}
          aria-label="Filter by source"
        >
          {SOURCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Company contains…"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          onKeyDown={handleKeyDown}
          className={`${inputClass} ${widths.company}`}
          aria-label="Filter by company"
        />

        <input
          type="number"
          placeholder="Min score"
          min="0"
          max="100"
          value={minScore}
          onChange={(e) => setMinScore(e.target.value)}
          onKeyDown={handleKeyDown}
          className={`${inputClass} ${widths.score}`}
          aria-label="Minimum lead score"
        />

        <input
          type="text"
          placeholder="Tag…"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          onKeyDown={handleKeyDown}
          className={`${inputClass} ${widths.tag}`}
          aria-label="Filter by tag"
        />
      </>
    );
  }

  return (
    <>
      {/* Desktop: inline filters */}
      <div className="hidden flex-wrap items-center gap-2 lg:flex">
        {fields({
          select: "",
          company: "w-full sm:w-44",
          score: "w-full sm:w-28",
          tag: "w-full sm:w-28",
        })}

        <button
          onClick={apply}
          disabled={isPending}
          className="tap flex items-center justify-center rounded-lg bg-[--accent] px-3 text-sm font-medium text-[--accent-ink] hover:bg-[--accent-hover] disabled:opacity-50"
        >
          Apply
        </button>

        {hasFilters && (
          <button
            onClick={clear}
            disabled={isPending}
            className="tap flex items-center justify-center rounded-lg border border-[--line-1] px-3 text-sm text-[--ink-2] hover:border-[--line-2] hover:text-[--ink-1] disabled:opacity-50"
          >
            Clear
          </button>
        )}
      </div>

      {/* Mobile: collapse filters behind a single button */}
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        aria-label="Filters"
        className="tap flex items-center gap-2 rounded-lg border border-[--line-1] bg-[--surface-2] px-3 text-sm text-[--ink-1] transition-colors hover:border-[--line-2] lg:hidden"
      >
        Filters
        {activeCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[--accent] px-1.5 text-xs font-medium text-[--accent-ink]">
            {activeCount}
          </span>
        )}
      </button>

      <MobileActionSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Filters"
      >
        <div className="flex flex-col gap-3">
          {fields({
            select: "w-full",
            company: "w-full",
            score: "w-full",
            tag: "w-full",
          })}

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => {
                apply();
                setSheetOpen(false);
              }}
              disabled={isPending}
              className="tap flex flex-1 items-center justify-center rounded-lg bg-[--accent] px-3 text-sm font-medium text-[--accent-ink] hover:bg-[--accent-hover] disabled:opacity-50"
            >
              Apply
            </button>

            {hasFilters && (
              <button
                onClick={() => {
                  clear();
                  setSheetOpen(false);
                }}
                disabled={isPending}
                className="tap flex items-center justify-center rounded-lg border border-[--line-1] px-3 text-sm text-[--ink-2] hover:border-[--line-2] hover:text-[--ink-1] disabled:opacity-50"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </MobileActionSheet>
    </>
  );
}
