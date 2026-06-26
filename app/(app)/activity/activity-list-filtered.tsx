"use client";

import { useEffect, useState, useTransition } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import MobileActionSheet from "@/components/mobile-action-sheet";
import ActivityToggle from "./activity-toggle";
import ActivityUndoButton from "./activity-undo-button";

function formatCompletedAt(isoString: string): string {
  const d = new Date(isoString);
  const dateStr = d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${dateStr} at ${timeStr}`;
}

function formatActivityDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelativeTime(isoString: string, nowMs: number): string {
  const diffMs = nowMs - new Date(isoString).getTime();
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.round(day / 7);
  if (wk < 5) return `${wk}w ago`;
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-caption uppercase tracking-wider text-[var(--ink-3)]">{label}</dt>
      <dd className="mt-0.5 truncate text-body text-[var(--ink-1)]">{value}</dd>
    </div>
  );
}

type ActivityType = "call" | "email" | "meeting" | "note" | "task";

const TYPE_META: Record<ActivityType, { label: string; color: string; bg: string }> = {
  call:    { label: "Call",    color: "text-[var(--info)]",   bg: "bg-[var(--info-tint)]" },
  email:   { label: "Email",   color: "text-[var(--accent)]", bg: "bg-[var(--accent-tint)]" },
  meeting: { label: "Meeting", color: "text-[var(--ok)]",     bg: "bg-[var(--ok-tint)]" },
  note:    { label: "Note",    color: "text-[var(--warn)]",   bg: "bg-[var(--warn-tint)]" },
  task:    { label: "Task",    color: "text-[var(--info)]",   bg: "bg-[var(--info-tint)]" },
};

const TYPE_ICON: Record<ActivityType, ReactNode> = {
  call: (
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
  ),
  email: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 5L2 7" />
    </>
  ),
  meeting: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  note: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </>
  ),
  task: (
    <>
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </>
  ),
};

const TYPE_CHIPS = [
  { value: "", label: "All" },
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Meeting" },
  { value: "note", label: "Note" },
  { value: "task", label: "Task" },
] as const;

const RANGE_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "", label: "All time" },
] as const;

export type SerializedRow = {
  activity: {
    id: number;
    type: string;
    subject: string;
    body: string | null;
    createdAt: string;
    dueAt: string | null;
    completedAt: string | null;
    contactId: number | null;
    dealId: number | null;
  };
  contactName: string | null;
  dealTitle: string | null;
};

interface Props {
  rows: SerializedRow[];
  offset: number;
  currentType: string;
  currentRange: string;
  total: number;
}

export default function ActivityListFiltered({ rows, offset, currentType, currentRange, total }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [contactQuery, setContactQuery] = useState("");
  const [rangeSheetOpen, setRangeSheetOpen] = useState(false);
  // Mobile-only: which activity's full detail is open in the bottom sheet.
  const [detailRow, setDetailRow] = useState<SerializedRow | null>(null);

  // The server now sends only the page at `offset` (bounded fetch). We
  // accumulate pages client-side so "Load more" appends instead of replacing.
  const [pages, setPages] = useState<SerializedRow[]>(rows);

  // Stable signature of the incoming page — the merge effect only re-runs when
  // the server page actually changes (navigation or revalidate), never per render.
  const rowsSig = rows.map((r) => r.activity.id).join(",");

  useEffect(() => {
    setPages((prev) => {
      // offset 0 is the head page: a filter change or revalidate replaces the list.
      if (offset === 0) return rows;
      const seen = new Set<number>();
      const merged: SerializedRow[] = [];
      for (const r of prev) {
        if (!seen.has(r.activity.id)) {
          seen.add(r.activity.id);
          merged.push(r);
        }
      }
      for (const r of rows) {
        if (!seen.has(r.activity.id)) {
          seen.add(r.activity.id);
          merged.push(r);
        }
      }
      return merged;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, rowsSig]);

  const currentRangeLabel =
    RANGE_OPTIONS.find((o) => o.value === currentRange)?.label ?? "All time";

  function navigate(type: string, range: string) {
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    if (range) params.set("range", range);
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/activity?${qs}` : "/activity");
    });
  }

  function loadMore() {
    const params = new URLSearchParams();
    if (currentType) params.set("type", currentType);
    if (currentRange) params.set("range", currentRange);
    params.set("offset", String(pages.length));
    startTransition(() => {
      router.push(`/activity?${params.toString()}`);
    });
  }

  const hasMore = pages.length < total;

  const now = new Date();

  const filtered = pages.filter(({ contactName }) => {
    if (contactQuery.trim()) {
      const q = contactQuery.trim().toLowerCase();
      if (!contactName || !contactName.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const isClientFilterZero = pages.length > 0 && contactQuery.trim() !== "" && filtered.length === 0;
  const isServerFilterZero = pages.length === 0 && !!(currentType || currentRange);
  const isNoData = pages.length === 0 && !currentType && !currentRange;

  return (
    <div className="card overflow-hidden">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line-1)] px-4 py-2">
        {total > 0 && (
          <span className="shrink-0 text-footnote text-[var(--ink-3)]">
            {pages.length < total
              ? `${pages.length} of ${total}`
              : String(total)}{" "}
            {total === 1 ? "activity" : "activities"}
          </span>
        )}

        {/* Type chips */}
        <div className="flex flex-wrap gap-1.5">
          {TYPE_CHIPS.map(({ value, label }) => {
            const isActive = currentType === value;
            return (
              <button
                key={value || "all"}
                onClick={() => navigate(value, currentRange)}
                disabled={isPending}
                className={`tap inline-flex items-center rounded-[var(--r-pill)] px-3 text-caption font-medium transition-all disabled:opacity-50 ${
                  isActive
                    ? "bg-[var(--accent)] text-[var(--accent-ink)]"
                    : "bg-[var(--surface-2)] text-[var(--ink-2)] hover:text-[var(--ink-1)]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Date-range: inline select on lg+, action sheet on phones */}
        <select
          value={currentRange}
          onChange={(e) => navigate(currentType, e.target.value)}
          disabled={isPending}
          className="tap hidden rounded-[var(--r-md)] border border-[var(--line-1)] bg-[var(--surface-2)] px-2.5 text-caption text-[var(--ink-2)] focus:border-[var(--accent)] focus:outline-none disabled:opacity-50 [color-scheme:dark] lg:block"
          aria-label="Date range"
        >
          {RANGE_OPTIONS.map(({ value, label }) => (
            <option key={value || "all"} value={value}>
              {label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setRangeSheetOpen(true)}
          disabled={isPending}
          aria-label="Date range"
          className="tap inline-flex items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--line-1)] bg-[var(--surface-2)] px-2.5 text-caption text-[var(--ink-2)] transition-colors hover:text-[var(--ink-1)] disabled:opacity-50 lg:hidden"
        >
          {currentRangeLabel}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        <MobileActionSheet
          open={rangeSheetOpen}
          onClose={() => setRangeSheetOpen(false)}
          title="Date range"
        >
          <div className="flex flex-col gap-1">
            {RANGE_OPTIONS.map(({ value, label }) => {
              const isActive = currentRange === value;
              return (
                <button
                  key={value || "all"}
                  type="button"
                  onClick={() => {
                    navigate(currentType, value);
                    setRangeSheetOpen(false);
                  }}
                  className={`tap flex min-h-[44px] w-full items-center rounded-[var(--r-md)] px-3 text-body transition-colors ${
                    isActive
                      ? "bg-[var(--surface-3)] text-[var(--ink-1)]"
                      : "text-[var(--ink-2)] hover:bg-[var(--surface-3)]"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </MobileActionSheet>

        {/* Contact search — full width on mobile, auto on sm+ */}
        <input
          type="text"
          value={contactQuery}
          onChange={(e) => setContactQuery(e.target.value)}
          placeholder="Search contact…"
          className="tap w-full rounded-[var(--r-md)] border border-[var(--line-1)] bg-[var(--surface-2)] px-3 text-caption text-[var(--ink-1)] placeholder:text-[var(--ink-3)] outline-none focus:border-[var(--accent)] sm:ml-auto sm:w-40 [color-scheme:dark]"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-[var(--r-lg)] border border-[var(--line-1)] bg-[var(--surface-2)] text-[var(--ink-3)]">
            {isNoData ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
            )}
          </div>
          <p className="text-body font-medium text-[var(--ink-1)]">
            {isNoData
              ? "No activity logged yet"
              : isClientFilterZero
              ? "No activities match your search"
              : "No activities match the current filters"}
          </p>
          <p className="max-w-xs text-footnote text-[var(--ink-3)]">
            {isNoData
              ? "Use the form above to log your first call, email, or meeting."
              : isClientFilterZero
              ? "Try clearing the contact search or adjusting the filters."
              : "Try adjusting the type or date range filters."}
          </p>
          {isServerFilterZero && (
            <button
              onClick={() => navigate("", "")}
              className="tap mt-1 inline-flex items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--line-1)] bg-[var(--surface-2)] px-3 text-caption font-medium text-[var(--ink-2)] transition-colors hover:text-[var(--ink-1)]"
            >
              Clear filters
            </button>
          )}
          {isClientFilterZero && (
            <button
              onClick={() => setContactQuery("")}
              className="tap mt-1 inline-flex items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--line-1)] bg-[var(--surface-2)] px-3 text-caption font-medium text-[var(--ink-2)] transition-colors hover:text-[var(--ink-1)]"
            >
              Clear search
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop list — full inline detail, unchanged */}
          <ul className="hidden divide-y divide-[var(--line-1)] lg:block">
            {filtered.map(({ activity, contactName, dealTitle }) => {
              const meta = TYPE_META[activity.type as ActivityType];
              const date = activity.createdAt.slice(0, 10);
              const isCompleted = !!activity.completedAt;
              const isOverdue =
                !!activity.dueAt && !isCompleted && new Date(activity.dueAt) < now;
              return (
                <li
                  key={activity.id}
                  className={`flex gap-3 px-4 py-3 ${isOverdue ? "bg-[var(--bad-tint)]" : ""}`}
                >
                  <ActivityToggle
                    activityId={activity.id}
                    isCompleted={isCompleted}
                    contactId={activity.contactId}
                    dealId={activity.dealId}
                  />
                  <div
                    className={`mt-0.5 shrink-0 flex flex-wrap gap-1.5 items-start ${
                      isCompleted ? "opacity-40" : ""
                    }`}
                  >
                    <span
                      className={`inline-block rounded-[var(--r-pill)] ${meta.bg} px-2 py-0.5 text-caption font-medium ${meta.color}`}
                    >
                      {meta.label}
                    </span>
                    {isOverdue && (
                      <span className="inline-block rounded-[var(--r-pill)] bg-[var(--bad-tint)] px-2 py-0.5 text-caption font-medium text-[var(--bad)]">
                        Overdue
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-body font-medium ${
                        isCompleted ? "text-[var(--ink-3)] line-through" : "text-[var(--ink-1)]"
                      }`}
                    >
                      {activity.subject}
                    </p>
                    {activity.body && (
                      <p
                        className={`mt-0.5 line-clamp-2 text-footnote ${
                          isCompleted ? "text-[var(--ink-3)]" : "text-[var(--ink-2)]"
                        }`}
                      >
                        {activity.body}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-caption text-[var(--ink-3)]">
                      <span>{date}</span>
                      {activity.dueAt && (
                        <>
                          <span aria-hidden>·</span>
                          <span className={isOverdue ? "text-[var(--bad)]" : "text-[var(--ink-3)]"}>
                            Due {activity.dueAt.slice(0, 10)}
                          </span>
                        </>
                      )}
                      {contactName && (
                        <>
                          <span aria-hidden>·</span>
                          <span>{contactName}</span>
                        </>
                      )}
                      {dealTitle && (
                        <>
                          <span aria-hidden>·</span>
                          <span>{dealTitle}</span>
                        </>
                      )}
                      {isCompleted && activity.completedAt && (
                        <>
                          <span aria-hidden>·</span>
                          <span className="text-[var(--ink-3)]">
                            Completed {formatCompletedAt(activity.completedAt)}
                          </span>
                          <span aria-hidden>·</span>
                          <ActivityUndoButton
                            activityId={activity.id}
                            contactId={activity.contactId}
                            dealId={activity.dealId}
                          />
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Mobile stacked cards — big glanceable tiles that tap to open a detail sheet */}
          <ul className="anim-stagger flex flex-col gap-2 p-3 lg:hidden">
            {filtered.map((row) => {
              const { activity, contactName, dealTitle } = row;
              const meta = TYPE_META[activity.type as ActivityType];
              const isCompleted = !!activity.completedAt;
              const isOverdue =
                !!activity.dueAt && !isCompleted && new Date(activity.dueAt) < now;
              const linked = contactName || dealTitle;
              return (
                <li
                  key={activity.id}
                  className={`flex items-start gap-3 rounded-[var(--r-lg)] border px-3 py-3 ${
                    isOverdue
                      ? "border-[var(--bad)]/30 bg-[var(--bad-tint)]"
                      : "border-[var(--line-1)] bg-[var(--surface-2)]"
                  }`}
                >
                  {/* Type icon badge */}
                  <div
                    className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--r-md)] ${meta.bg} ${
                      isCompleted ? "opacity-40" : ""
                    }`}
                  >
                    <svg
                      className={meta.color}
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      {TYPE_ICON[activity.type as ActivityType]}
                    </svg>
                  </div>

                  <button
                    type="button"
                    onClick={() => setDetailRow(row)}
                    className="tap flex min-h-[44px] min-w-0 flex-1 flex-col justify-center text-left"
                  >
                    <div className="flex items-start gap-2">
                      <p
                        className={`min-w-0 flex-1 text-body font-semibold leading-snug ${
                          isCompleted ? "text-[var(--ink-3)] line-through" : "text-[var(--ink-1)]"
                        }`}
                      >
                        {activity.subject}
                      </p>
                      <span className="shrink-0 text-caption text-[var(--ink-3)]">
                        {formatRelativeTime(activity.createdAt, now.getTime())}
                      </span>
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 truncate text-footnote text-[var(--ink-3)]">
                      <span className={`shrink-0 font-medium ${meta.color}`}>
                        {meta.label}
                      </span>
                      {linked && (
                        <>
                          <span aria-hidden>·</span>
                          <span className="truncate">
                            {contactName ?? dealTitle}
                          </span>
                        </>
                      )}
                    </p>
                    {isOverdue && (
                      <span className="mt-1.5 inline-flex w-fit items-center rounded-[var(--r-pill)] bg-[var(--bad-tint)] px-2 py-0.5 text-caption font-medium text-[var(--bad)]">
                        Overdue
                      </span>
                    )}
                  </button>

                  <ActivityToggle
                    activityId={activity.id}
                    isCompleted={isCompleted}
                    contactId={activity.contactId}
                    dealId={activity.dealId}
                  />
                </li>
              );
            })}
          </ul>

          {hasMore && !contactQuery.trim() && (
            <div className="border-t border-[var(--line-1)] px-4 py-3 text-center">
              <button
                onClick={loadMore}
                disabled={isPending}
                className="tap inline-flex items-center gap-2 rounded-[var(--r-md)] border border-[var(--line-1)] bg-[var(--surface-2)] px-4 text-caption font-medium text-[var(--ink-2)] transition-colors hover:text-[var(--ink-1)] disabled:opacity-50"
              >
                {isPending ? "Loading…" : `Load more (${total - pages.length} remaining)`}
              </button>
            </div>
          )}
        </>
      )}

      {/* Mobile activity detail sheet */}
      <MobileActionSheet
        open={!!detailRow}
        onClose={() => setDetailRow(null)}
        title="Activity"
      >
        {detailRow &&
          (() => {
            const { activity, contactName, dealTitle } = detailRow;
            const meta = TYPE_META[activity.type as ActivityType];
            const isCompleted = !!activity.completedAt;
            const isOverdue =
              !!activity.dueAt && !isCompleted && new Date(activity.dueAt) < now;
            return (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`inline-block rounded-[var(--r-pill)] ${meta.bg} px-2 py-0.5 text-caption font-medium ${meta.color}`}
                  >
                    {meta.label}
                  </span>
                  {isOverdue && (
                    <span className="inline-block rounded-[var(--r-pill)] bg-[var(--bad-tint)] px-2 py-0.5 text-caption font-medium text-[var(--bad)]">
                      Overdue
                    </span>
                  )}
                  {isCompleted && (
                    <span className="inline-block rounded-[var(--r-pill)] bg-[var(--ok-tint)] px-2 py-0.5 text-caption font-medium text-[var(--ok)]">
                      Completed
                    </span>
                  )}
                </div>

                <p
                  className={`text-callout font-semibold ${
                    isCompleted ? "text-[var(--ink-3)] line-through" : "text-[var(--ink-1)]"
                  }`}
                >
                  {activity.subject}
                </p>

                {activity.body && (
                  <p className="whitespace-pre-wrap text-body text-[var(--ink-2)]">
                    {activity.body}
                  </p>
                )}

                <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <DetailField
                    label="Logged"
                    value={formatActivityDate(activity.createdAt)}
                  />
                  {activity.dueAt && (
                    <DetailField
                      label="Due"
                      value={formatActivityDate(activity.dueAt)}
                    />
                  )}
                </dl>

                {(contactName || dealTitle) && (
                  <div className="flex flex-col gap-1.5">
                    {activity.contactId && contactName && (
                      <Link
                        href={`/contacts/${activity.contactId}`}
                        onClick={() => setDetailRow(null)}
                        className="tap flex min-h-[44px] items-center justify-between rounded-[var(--r-md)] border border-[var(--line-1)] bg-[var(--surface-3)] px-3 text-body text-[var(--ink-1)]"
                      >
                        <span className="truncate">{contactName}</span>
                        <span className="shrink-0 text-caption text-[var(--ink-3)]">Contact</span>
                      </Link>
                    )}
                    {activity.dealId && dealTitle && (
                      <Link
                        href={`/deals/${activity.dealId}`}
                        onClick={() => setDetailRow(null)}
                        className="tap flex min-h-[44px] items-center justify-between rounded-[var(--r-md)] border border-[var(--line-1)] bg-[var(--surface-3)] px-3 text-body text-[var(--ink-1)]"
                      >
                        <span className="truncate">{dealTitle}</span>
                        <span className="shrink-0 text-caption text-[var(--ink-3)]">Deal</span>
                      </Link>
                    )}
                  </div>
                )}

                {isCompleted && activity.completedAt && (
                  <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line-1)] pt-3 text-footnote text-[var(--ink-3)]">
                    <span>Completed {formatCompletedAt(activity.completedAt)}</span>
                    <ActivityUndoButton
                      activityId={activity.id}
                      contactId={activity.contactId}
                      dealId={activity.dealId}
                    />
                  </div>
                )}
              </div>
            );
          })()}
      </MobileActionSheet>
    </div>
  );
}
