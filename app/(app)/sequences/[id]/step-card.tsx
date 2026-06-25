"use client";

import { useState, useActionState, useEffect, startTransition } from "react";
import type { SequenceStep } from "@/db/schema";
import {
  addStep,
  updateStep,
  deleteStep,
  reorderStep,
  draftStepContent,
  type StepFormState,
} from "./actions";

const INIT: StepFormState = {};

export function StepCard({
  step,
  sequenceId,
  isFirst,
  isLast,
}: {
  step: SequenceStep;
  sequenceId: number;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reordering, setReordering] = useState(false);

  const boundUpdate = updateStep.bind(null, step.id, sequenceId);
  const [state, formAction, pending] = useActionState(boundUpdate, INIT);

  useEffect(() => {
    if (state.success) setEditing(false);
  }, [state.success]);

  async function handleDelete() {
    setDeleting(true);
    await deleteStep(step.id, sequenceId);
    setDeleting(false);
  }

  async function handleReorder(direction: "up" | "down") {
    setReordering(true);
    await reorderStep(step.id, sequenceId, direction);
    setReordering(false);
  }

  return (
    <div className="card p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[--accent-tint] text-xs font-semibold text-[--accent]">
            {step.position}
          </span>
          <span className="text-footnote text-[--ink-3]">
            {step.delayDays === 0
              ? "Send immediately"
              : `Send after ${step.delayDays} day${step.delayDays === 1 ? "" : "s"}`}
          </span>
        </div>
        {!editing && (
          <div className="flex items-center gap-1">
            <div className="flex items-center">
              <button
                onClick={() => handleReorder("up")}
                disabled={isFirst || reordering}
                title="Move up"
                className="tap flex items-center justify-center rounded-[--r-sm] text-[--ink-3] transition-colors hover:bg-[--surface-2] hover:text-[--ink-1] disabled:cursor-not-allowed disabled:opacity-30"
              >
                ▲
              </button>
              <button
                onClick={() => handleReorder("down")}
                disabled={isLast || reordering}
                title="Move down"
                className="tap flex items-center justify-center rounded-[--r-sm] text-[--ink-3] transition-colors hover:bg-[--surface-2] hover:text-[--ink-1] disabled:cursor-not-allowed disabled:opacity-30"
              >
                ▼
              </button>
            </div>
            <button
              onClick={() => setEditing(true)}
              className="tap flex items-center justify-center rounded-[--r-md] px-3 text-xs font-medium text-[--ink-2] transition-colors hover:bg-[--surface-2] hover:text-[--ink-1]"
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="tap flex items-center justify-center rounded-[--r-md] px-3 text-xs font-medium text-[--bad] transition-colors hover:bg-[--bad-tint] disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <form
          action={(fd) => startTransition(() => formAction(fd))}
          className="space-y-3"
        >
          {state.noDb && (
            <p className="text-xs text-[--warn]">Database not connected.</p>
          )}
          <div>
            <label className="mb-1 block text-footnote font-medium text-[--ink-2]">
              Delay (days)
            </label>
            <input
              type="number"
              name="delayDays"
              min={0}
              defaultValue={step.delayDays}
              className="tap w-24 rounded-[--r-md] border border-[--line-1] bg-[--surface-2] px-3 text-body text-[--ink-1] focus:border-[--accent] focus:outline-none [color-scheme:dark]"
            />
            {state.fieldErrors?.delayDays && (
              <p className="mt-1 text-xs text-[--bad]">
                {state.fieldErrors.delayDays[0]}
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-footnote font-medium text-[--ink-2]">
              Subject template
            </label>
            <input
              type="text"
              name="subjectTemplate"
              defaultValue={step.subjectTemplate}
              className="tap w-full rounded-[--r-md] border border-[--line-1] bg-[--surface-2] px-3 text-body text-[--ink-1] placeholder-[--ink-3] focus:border-[--accent] focus:outline-none"
            />
            {state.fieldErrors?.subjectTemplate && (
              <p className="mt-1 text-xs text-[--bad]">
                {state.fieldErrors.subjectTemplate[0]}
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-footnote font-medium text-[--ink-2]">
              Body template
            </label>
            <textarea
              name="bodyTemplate"
              rows={4}
              defaultValue={step.bodyTemplate}
              className="w-full resize-none rounded-[--r-md] border border-[--line-1] bg-[--surface-2] px-3 py-2 text-body text-[--ink-1] placeholder-[--ink-3] focus:border-[--accent] focus:outline-none"
            />
            {state.fieldErrors?.bodyTemplate && (
              <p className="mt-1 text-xs text-[--bad]">
                {state.fieldErrors.bodyTemplate[0]}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={pending}
              className="tap flex items-center justify-center rounded-[--r-md] bg-[--accent] px-4 text-body font-medium text-[--accent-ink] press hover:bg-[--accent-hover] disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="tap flex items-center justify-center rounded-[--r-md] border border-[--line-1] px-4 text-body font-medium text-[--ink-2] transition-colors hover:bg-[--surface-2]"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="mb-0.5 text-footnote font-medium text-[--ink-3]">Subject</p>
            <p className="text-body text-[--ink-1] break-words">{step.subjectTemplate}</p>
          </div>
          <div>
            <p className="mb-0.5 text-footnote font-medium text-[--ink-3]">Body</p>
            <p className="whitespace-pre-wrap text-body text-[--ink-2] break-words">
              {step.bodyTemplate}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function AddStepForm({
  sequenceId,
  sequenceName,
  nextPosition,
  hasAiKey,
}: {
  sequenceId: number;
  sequenceName: string;
  nextPosition: number;
  hasAiKey: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  const boundAdd = addStep.bind(null, sequenceId);
  const [state, formAction, pending] = useActionState(boundAdd, INIT);

  useEffect(() => {
    if (state.success) {
      setOpen(false);
      setSubject("");
      setBody("");
    }
  }, [state.success]);

  async function handleAiDraft() {
    setDrafting(true);
    setDraftError(null);
    const result = await draftStepContent(sequenceName, nextPosition);
    setDrafting(false);
    if (result.error) {
      setDraftError(result.error);
    } else {
      if (result.subjectTemplate) setSubject(result.subjectTemplate);
      if (result.bodyTemplate) setBody(result.bodyTemplate);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="tap flex w-full items-center justify-center gap-2 rounded-[--r-xl] border border-dashed border-[--line-2] bg-[--surface-1]/50 text-body font-medium text-[--ink-2] transition-colors hover:border-[--accent] hover:text-[--accent]"
      >
        <span className="text-lg leading-none">+</span>
        Add step
      </button>
    );
  }

  return (
    <div className="card p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-body font-medium text-[--ink-1]">New step</p>
        {hasAiKey && (
          <button
            type="button"
            onClick={handleAiDraft}
            disabled={drafting}
            className="tap flex items-center justify-center gap-1.5 rounded-[--r-md] border border-[--accent-tint] bg-[--accent-tint] px-3 text-xs font-medium text-[--accent] transition-colors hover:bg-[--accent-tint]/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {drafting ? (
              <>
                <span className="inline-block h-3 w-3 animate-spin rounded-full border border-[--accent] border-t-transparent" />
                Drafting…
              </>
            ) : (
              <>✦ AI draft</>
            )}
          </button>
        )}
      </div>
      {draftError && (
        <p className="mb-3 text-xs text-[--bad]">{draftError}</p>
      )}
      <form
        action={(fd) => startTransition(() => formAction(fd))}
        className="space-y-3"
      >
        {state.noDb && (
          <p className="text-xs text-[--warn]">Database not connected.</p>
        )}
        <div>
          <label className="mb-1 block text-footnote font-medium text-[--ink-2]">
            Delay (days before sending)
          </label>
          <input
            type="number"
            name="delayDays"
            min={0}
            defaultValue={0}
            className="tap w-24 rounded-[--r-md] border border-[--line-1] bg-[--surface-2] px-3 text-body text-[--ink-1] focus:border-[--accent] focus:outline-none [color-scheme:dark]"
          />
          {state.fieldErrors?.delayDays && (
            <p className="mt-1 text-xs text-[--bad]">
              {state.fieldErrors.delayDays[0]}
            </p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-footnote font-medium text-[--ink-2]">
            Subject template
          </label>
          <input
            type="text"
            name="subjectTemplate"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Quick question, {{firstName}}"
            className="tap w-full rounded-[--r-md] border border-[--line-1] bg-[--surface-2] px-3 text-body text-[--ink-1] placeholder-[--ink-3] focus:border-[--accent] focus:outline-none"
          />
          {state.fieldErrors?.subjectTemplate && (
            <p className="mt-1 text-xs text-[--bad]">
              {state.fieldErrors.subjectTemplate[0]}
            </p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-footnote font-medium text-[--ink-2]">
            Body template
          </label>
          <textarea
            name="bodyTemplate"
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={"Hi {{firstName}},\n\n…"}
            className="w-full resize-none rounded-[--r-md] border border-[--line-1] bg-[--surface-2] px-3 py-2 text-body text-[--ink-1] placeholder-[--ink-3] focus:border-[--accent] focus:outline-none"
          />
          {state.fieldErrors?.bodyTemplate && (
            <p className="mt-1 text-xs text-[--bad]">
              {state.fieldErrors.bodyTemplate[0]}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={pending}
            className="tap flex items-center justify-center rounded-[--r-md] bg-[--accent] px-4 text-body font-medium text-[--accent-ink] press hover:bg-[--accent-hover] disabled:opacity-50"
          >
            {pending ? "Adding…" : "Add step"}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setSubject("");
              setBody("");
              setDraftError(null);
            }}
            className="tap flex items-center justify-center rounded-[--r-md] border border-[--line-1] px-4 text-body font-medium text-[--ink-2] transition-colors hover:bg-[--surface-2]"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
