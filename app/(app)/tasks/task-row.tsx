"use client";

import { useState } from "react";
import Link from "next/link";
import TaskToggle from "./task-toggle";
import MobileActionSheet from "@/components/mobile-action-sheet";
import { formatDate } from "@/lib/format";

export type TaskRowData = {
  id: number;
  subject: string;
  body: string | null;
  dueAt: string;
  completedAt: string | null;
  contactId: number | null;
  dealId: number | null;
  contactName: string | null;
  dealTitle: string | null;
};

function formatShort(iso: string): string {
  return formatDate(iso, { year: false });
}

function formatLong(iso: string): string {
  return formatDate(iso);
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-caption uppercase tracking-wider text-[var(--ink-3)]">{label}</dt>
      <dd className="mt-0.5 truncate text-body text-[var(--ink-1)]">{value}</dd>
    </div>
  );
}

/**
 * Shared task row. Desktop (lg+) keeps the original one-line layout with inline
 * contact/deal links. On phones the row stays compact and tapping it opens the
 * full task — notes, links, dates — in a bottom sheet (iOS-Weather pattern).
 */
export default function TaskRow({ task }: { task: TaskRowData }) {
  const [open, setOpen] = useState(false);
  const completed = !!task.completedAt;
  // Completed tasks surface when they were finished; open tasks surface the due date.
  const stamp = completed && task.completedAt ? task.completedAt : task.dueAt;
  const formatted = formatShort(stamp);

  return (
    <div>
      {/* Desktop — unchanged inline layout */}
      <div
        className={`hidden min-h-[44px] items-center gap-3 py-2 lg:flex ${
          completed ? "opacity-50" : ""
        }`}
      >
        <TaskToggle
          activityId={task.id}
          isCompleted={completed}
          contactId={task.contactId}
          dealId={task.dealId}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className={`text-body ${completed ? "text-[var(--ink-3)] line-through" : "text-[var(--ink-1)]"}`}>
            {task.subject}
          </p>
          {(task.contactName || task.dealTitle) && (
            <div className="flex flex-wrap items-center gap-2 text-footnote text-[var(--ink-3)]">
              {task.contactId && task.contactName && (
                <Link
                  href={`/contacts/${task.contactId}`}
                  className="transition-colors hover:text-[var(--accent)]"
                >
                  {task.contactName}
                </Link>
              )}
              {task.contactId && task.contactName && task.dealId && task.dealTitle && (
                <span>·</span>
              )}
              {task.dealId && task.dealTitle && (
                <Link
                  href={`/deals/${task.dealId}`}
                  className="transition-colors hover:text-[var(--accent)]"
                >
                  {task.dealTitle}
                </Link>
              )}
            </div>
          )}
        </div>
        <span className="shrink-0 text-footnote text-[var(--ink-3)]">
          {completed ? `Done ${formatted}` : formatted}
        </span>
      </div>

      {/* Mobile — compact one-line row that taps to open the detail sheet */}
      <div
        className={`flex items-center gap-3 lg:hidden ${completed ? "opacity-50" : ""}`}
      >
        <TaskToggle
          activityId={task.id}
          isCompleted={completed}
          contactId={task.contactId}
          dealId={task.dealId}
        />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="tap flex min-h-[44px] min-w-0 flex-1 items-center gap-2 py-1.5 text-left"
        >
          <div className="min-w-0 flex-1">
            <p
              className={`truncate text-body text-[var(--ink-1)] ${
                completed ? "line-through" : ""
              }`}
            >
              {task.subject}
            </p>
            {(task.contactName || task.dealTitle) && (
              <p className="mt-0.5 truncate text-footnote text-[var(--ink-3)]">
                {[task.contactName, task.dealTitle].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          <span className="shrink-0 text-footnote text-[var(--ink-3)]">
            {completed ? `Done ${formatted}` : formatted}
          </span>
          <svg
            className="shrink-0 text-[var(--ink-3)]"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Mobile task detail sheet */}
      <MobileActionSheet open={open} onClose={() => setOpen(false)} title="Task">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <TaskToggle
              activityId={task.id}
              isCompleted={completed}
              contactId={task.contactId}
              dealId={task.dealId}
            />
            <p
              className={`text-callout font-semibold ${
                completed ? "text-[var(--ink-3)] line-through" : "text-[var(--ink-1)]"
              }`}
            >
              {task.subject}
            </p>
          </div>

          {task.body && (
            <p className="whitespace-pre-wrap text-body text-[var(--ink-2)]">{task.body}</p>
          )}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <DetailField label="Due" value={formatLong(task.dueAt)} />
            {completed && task.completedAt && (
              <DetailField label="Completed" value={formatLong(task.completedAt)} />
            )}
          </dl>

          {(task.contactName || task.dealTitle) && (
            <div className="flex flex-col gap-1.5">
              {task.contactId && task.contactName && (
                <Link
                  href={`/contacts/${task.contactId}`}
                  onClick={() => setOpen(false)}
                  className="tap flex min-h-[44px] items-center justify-between rounded-[var(--r-md)] border border-[var(--line-1)] bg-[var(--surface-3)] px-3 text-body text-[var(--ink-1)]"
                >
                  <span className="truncate">{task.contactName}</span>
                  <span className="shrink-0 text-caption text-[var(--ink-3)]">Contact</span>
                </Link>
              )}
              {task.dealId && task.dealTitle && (
                <Link
                  href={`/deals/${task.dealId}`}
                  onClick={() => setOpen(false)}
                  className="tap flex min-h-[44px] items-center justify-between rounded-[var(--r-md)] border border-[var(--line-1)] bg-[var(--surface-3)] px-3 text-body text-[var(--ink-1)]"
                >
                  <span className="truncate">{task.dealTitle}</span>
                  <span className="shrink-0 text-caption text-[var(--ink-3)]">Deal</span>
                </Link>
              )}
            </div>
          )}
        </div>
      </MobileActionSheet>
    </div>
  );
}
