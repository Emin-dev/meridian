"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

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

  const hasFilters = status !== "" || company !== "" || minScore !== "" || source !== "" || tag !== "";

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
    "rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-100 placeholder-neutral-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className={inputClass}
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
        className={inputClass}
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
        className={`${inputClass} w-44`}
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
        className={`${inputClass} w-28`}
        aria-label="Minimum lead score"
      />

      <input
        type="text"
        placeholder="Tag…"
        value={tag}
        onChange={(e) => setTag(e.target.value)}
        onKeyDown={handleKeyDown}
        className={`${inputClass} w-28`}
        aria-label="Filter by tag"
      />

      <button
        onClick={apply}
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        Apply
      </button>

      {hasFilters && (
        <button
          onClick={clear}
          disabled={isPending}
          className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-400 hover:border-neutral-600 hover:text-neutral-200 disabled:opacity-50"
        >
          Clear
        </button>
      )}
    </div>
  );
}
