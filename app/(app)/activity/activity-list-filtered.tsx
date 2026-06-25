"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ActivityToggle from "./activity-toggle";

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
}

export default function ActivityListFiltered({ rows, currentType, currentRange }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [contactQuery, setContactQuery] = useState("");

  function navigate(type: string, range: string) {
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    if (range) params.set("range", range);
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/activity?${qs}` : "/activity");
    });
  }

  const now = new Date();

  const filtered = rows.filter(({ contactName }) => {
    if (contactQuery.trim()) {
      const q = contactQuery.trim().toLowerCase();
      if (!contactName || !contactName.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-neutral-800 px-5 py-3">
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
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-neutral-500">
            {rows.length === 0
              ? "No activity recorded yet."
              : "No activities match the current filters."}
          </p>
          {rows.length === 0 && (
            <p className="mt-1 text-xs text-neutral-600">Log your first activity above.</p>
          )}
        </div>
      ) : (
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
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
