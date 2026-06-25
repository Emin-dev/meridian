"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ActivityToggle from "./activity-toggle";
import ActivityUndoButton from "./activity-undo-button";

function formatCompletedAt(isoString: string): string {
  const d = new Date(isoString);
  const dateStr = d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${dateStr} at ${timeStr}`;
}

type ActivityType = "call" | "email" | "meeting" | "note" | "task";

const TYPE_META: Record<ActivityType, { label: string; color: string; bg: string }> = {
  call:    { label: "Call",    color: "text-blue-400",   bg: "bg-blue-900/30" },
  email:   { label: "Email",   color: "text-purple-400", bg: "bg-purple-900/30" },
  meeting: { label: "Meeting", color: "text-green-400",  bg: "bg-green-900/30" },
  note:    { label: "Note",    color: "text-amber-400",  bg: "bg-amber-900/30" },
  task:    { label: "Task",    color: "text-indigo-400", bg: "bg-indigo-900/30" },
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
  currentType: string;
  currentRange: string;
  total: number;
}

export default function ActivityListFiltered({ rows, currentType, currentRange, total }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [contactQuery, setContactQuery] = useState("");

  function navigate(type: string, range: string) {
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    if (range) params.set("range", range);
    // reset offset when changing filters
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/activity?${qs}` : "/activity");
    });
  }

  function loadMore() {
    const params = new URLSearchParams();
    if (currentType) params.set("type", currentType);
    if (currentRange) params.set("range", currentRange);
    params.set("offset", String(rows.length));
    startTransition(() => {
      router.push(`/activity?${params.toString()}`);
    });
  }

  const hasMore = rows.length < total;

  const now = new Date();

  const filtered = rows.filter(({ contactName }) => {
    if (contactQuery.trim()) {
      const q = contactQuery.trim().toLowerCase();
      if (!contactName || !contactName.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const isClientFilterZero = rows.length > 0 && contactQuery.trim() !== "" && filtered.length === 0;
  const isServerFilterZero = rows.length === 0 && !!(currentType || currentRange);
  const isNoData = rows.length === 0 && !currentType && !currentRange;

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-neutral-800 px-5 py-3">
        {total > 0 && (
          <span className="mr-1 shrink-0 text-xs text-neutral-500">
            {rows.length < total
              ? `${rows.length} of ${total}`
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
                className={`rounded-full px-3 py-1 text-xs font-medium transition-all disabled:opacity-50 ${
                  isActive
                    ? "bg-indigo-600 text-white"
                    : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Date-range dropdown */}
        <select
          value={currentRange}
          onChange={(e) => navigate(currentType, e.target.value)}
          disabled={isPending}
          className="rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-xs text-neutral-300 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
          aria-label="Date range"
        >
          {RANGE_OPTIONS.map(({ value, label }) => (
            <option key={value || "all"} value={value}>
              {label}
            </option>
          ))}
        </select>

        {/* Contact search (client-side) */}
        <input
          type="text"
          value={contactQuery}
          onChange={(e) => setContactQuery(e.target.value)}
          placeholder="Search contact…"
          className="ml-auto w-36 rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-xs text-neutral-200 placeholder-neutral-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-800/50 text-neutral-500">
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
          <p className="text-sm font-medium text-neutral-300">
            {isNoData
              ? "No activity logged yet"
              : isClientFilterZero
              ? "No activities match your search"
              : "No activities match the current filters"}
          </p>
          <p className="max-w-xs text-xs text-neutral-500">
            {isNoData
              ? "Use the form above to log your first call, email, or meeting."
              : isClientFilterZero
              ? "Try clearing the contact search or adjusting the filters."
              : "Try adjusting the type or date range filters."}
          </p>
          {isServerFilterZero && (
            <button
              onClick={() => navigate("", "")}
              className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-300 transition-colors hover:bg-neutral-700 hover:text-neutral-100"
            >
              Clear filters
            </button>
          )}
          {isClientFilterZero && (
            <button
              onClick={() => setContactQuery("")}
              className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-300 transition-colors hover:bg-neutral-700 hover:text-neutral-100"
            >
              Clear search
            </button>
          )}
        </div>
      ) : (
        <>
          <ul className="divide-y divide-neutral-800">
            {filtered.map(({ activity, contactName, dealTitle }) => {
              const meta = TYPE_META[activity.type as ActivityType];
              const date = activity.createdAt.slice(0, 10);
              const isCompleted = !!activity.completedAt;
              const isOverdue =
                !!activity.dueAt && !isCompleted && new Date(activity.dueAt) < now;
              return (
                <li
                  key={activity.id}
                  className={`flex gap-4 px-5 py-4 ${isOverdue ? "bg-red-950/20" : ""}`}
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
                      className={`inline-block rounded-full ${meta.bg} px-2 py-0.5 text-xs font-medium ${meta.color}`}
                    >
                      {meta.label}
                    </span>
                    {isOverdue && (
                      <span className="inline-block rounded-full bg-red-900/30 px-2 py-0.5 text-xs font-medium text-red-400">
                        Overdue
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-medium ${
                        isCompleted ? "text-neutral-500 line-through" : "text-neutral-200"
                      }`}
                    >
                      {activity.subject}
                    </p>
                    {activity.body && (
                      <p
                        className={`mt-0.5 line-clamp-2 text-xs ${
                          isCompleted ? "text-neutral-600" : "text-neutral-400"
                        }`}
                      >
                        {activity.body}
                      </p>
                    )}
                    <div className="mt-1 flex items-center gap-2 text-xs text-neutral-600">
                      <span>{date}</span>
                      {activity.dueAt && (
                        <>
                          <span aria-hidden>·</span>
                          <span className={isOverdue ? "text-red-400" : "text-neutral-500"}>
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
                          <span className="text-neutral-500">
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
          {hasMore && !contactQuery.trim() && (
            <div className="border-t border-neutral-800 px-5 py-4 text-center">
              <button
                onClick={loadMore}
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-xs font-medium text-neutral-300 transition-colors hover:bg-neutral-700 hover:text-neutral-100 disabled:opacity-50"
              >
                {isPending ? "Loading…" : `Load more (${total - rows.length} remaining)`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
