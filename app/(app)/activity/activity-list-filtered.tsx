"use client";

import { useState } from "react";
import ActivityToggle from "./activity-toggle";

type ActivityType = "call" | "email" | "meeting" | "note" | "task";

const TYPE_META: Record<ActivityType, { label: string; color: string; bg: string; ring: string }> = {
  call:    { label: "Call",    color: "text-blue-400",   bg: "bg-blue-900/30",   ring: "ring-blue-500" },
  email:   { label: "Email",   color: "text-purple-400", bg: "bg-purple-900/30", ring: "ring-purple-500" },
  meeting: { label: "Meeting", color: "text-green-400",  bg: "bg-green-900/30",  ring: "ring-green-500" },
  note:    { label: "Note",    color: "text-amber-400",  bg: "bg-amber-900/30",  ring: "ring-amber-500" },
  task:    { label: "Task",    color: "text-indigo-400", bg: "bg-indigo-900/30", ring: "ring-indigo-500" },
};

const ALL_TYPES = Object.keys(TYPE_META) as ActivityType[];

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
}

export default function ActivityListFiltered({ rows }: Props) {
  const [selectedTypes, setSelectedTypes] = useState<Set<ActivityType>>(new Set());
  const [contactQuery, setContactQuery] = useState("");

  function toggleType(t: ActivityType) {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  const now = new Date();

  const filtered = rows.filter(({ activity, contactName }) => {
    if (selectedTypes.size > 0 && !selectedTypes.has(activity.type as ActivityType)) return false;
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
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 shrink-0">
          Recent events
        </p>
        <div className="flex flex-wrap gap-1.5 ml-auto">
          {ALL_TYPES.map((t) => {
            const meta = TYPE_META[t];
            const active = selectedTypes.has(t);
            return (
              <button
                key={t}
                onClick={() => toggleType(t)}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-all ${meta.bg} ${meta.color} ${
                  active ? `ring-1 ${meta.ring} ring-offset-1 ring-offset-neutral-900` : "opacity-50 hover:opacity-80"
                }`}
              >
                {meta.label}
              </button>
            );
          })}
        </div>
        <input
          type="text"
          value={contactQuery}
          onChange={(e) => setContactQuery(e.target.value)}
          placeholder="Search contact…"
          className="w-36 rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-xs text-neutral-200 placeholder-neutral-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-neutral-500">
            {rows.length === 0 ? "No activity recorded yet." : "No activities match the current filters."}
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
              <li key={activity.id} className="flex gap-4 px-5 py-4">
                <ActivityToggle
                  activityId={activity.id}
                  isCompleted={isCompleted}
                  contactId={activity.contactId}
                  dealId={activity.dealId}
                />
                <div className={`mt-0.5 shrink-0 ${isCompleted ? "opacity-40" : ""}`}>
                  <span
                    className={`inline-block rounded-full ${meta.bg} px-2 py-0.5 text-xs font-medium ${meta.color}`}
                  >
                    {meta.label}
                  </span>
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
                        <span className={isOverdue ? "text-amber-400" : "text-neutral-500"}>
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
