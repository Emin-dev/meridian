"use client";

import { useState, useActionState, useEffect, startTransition } from "react";
import type { SequenceStep } from "@/db/schema";
import {
  addStep,
  updateStep,
  deleteStep,
  draftStepContent,
  type StepFormState,
} from "./actions";

const INIT: StepFormState = {};

export function StepCard({
  step,
  sequenceId,
}: {
  step: SequenceStep;
  sequenceId: number;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600/20 text-xs font-semibold text-indigo-400">
            {step.position}
          </span>
          <span className="text-xs text-neutral-500">
            {step.delayDays === 0
              ? "Send immediately"
              : `Send after ${step.delayDays} day${step.delayDays === 1 ? "" : "s"}`}
          </span>
        </div>
        {!editing && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditing(true)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-neutral-100"
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-50"
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
            <p className="text-xs text-amber-400">Database not connected.</p>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-400">
              Delay (days)
            </label>
            <input
              type="number"
              name="delayDays"
              min={0}
              defaultValue={step.delayDays}
              className="w-24 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-100 focus:border-indigo-500 focus:outline-none"
            />
            {state.fieldErrors?.delayDays && (
              <p className="mt-1 text-xs text-red-400">
                {state.fieldErrors.delayDays[0]}
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-400">
              Subject template
            </label>
            <input
              type="text"
              name="subjectTemplate"
              defaultValue={step.subjectTemplate}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-indigo-500 focus:outline-none"
            />
            {state.fieldErrors?.subjectTemplate && (
              <p className="mt-1 text-xs text-red-400">
                {state.fieldErrors.subjectTemplate[0]}
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-400">
              Body template
            </label>
            <textarea
              name="bodyTemplate"
              rows={4}
              defaultValue={step.bodyTemplate}
              className="w-full resize-none rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-indigo-500 focus:outline-none"
            />
            {state.fieldErrors?.bodyTemplate && (
              <p className="mt-1 text-xs text-red-400">
                {state.fieldErrors.bodyTemplate[0]}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-300 transition-colors hover:bg-neutral-700"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="mb-0.5 text-xs font-medium text-neutral-500">Subject</p>
            <p className="text-sm text-neutral-200">{step.subjectTemplate}</p>
          </div>
          <div>
            <p className="mb-0.5 text-xs font-medium text-neutral-500">Body</p>
            <p className="whitespace-pre-wrap text-sm text-neutral-400">
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
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-700 bg-neutral-900/50 py-4 text-sm font-medium text-neutral-400 transition-colors hover:border-indigo-500 hover:text-indigo-400"
      >
        <span className="text-lg leading-none">+</span>
        Add step
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-neutral-300">New step</p>
        {hasAiKey && (
          <button
            type="button"
            onClick={handleAiDraft}
            disabled={drafting}
            className="flex items-center gap-1.5 rounded-lg border border-indigo-700/50 bg-indigo-600/10 px-3 py-1.5 text-xs font-medium text-indigo-400 transition-colors hover:bg-indigo-600/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {drafting ? (
              <>
                <span className="inline-block h-3 w-3 animate-spin rounded-full border border-indigo-400 border-t-transparent" />
                Drafting…
              </>
            ) : (
              <>✦ AI draft</>
            )}
          </button>
        )}
      </div>
      {draftError && (
        <p className="mb-3 text-xs text-red-400">{draftError}</p>
      )}
      <form
        action={(fd) => startTransition(() => formAction(fd))}
        className="space-y-3"
      >
        {state.noDb && (
          <p className="text-xs text-amber-400">Database not connected.</p>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-400">
            Delay (days before sending)
          </label>
          <input
            type="number"
            name="delayDays"
            min={0}
            defaultValue={0}
            className="w-24 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-100 focus:border-indigo-500 focus:outline-none"
          />
          {state.fieldErrors?.delayDays && (
            <p className="mt-1 text-xs text-red-400">
              {state.fieldErrors.delayDays[0]}
            </p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-400">
            Subject template
          </label>
          <input
            type="text"
            name="subjectTemplate"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Quick question, {{first_name}}"
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-indigo-500 focus:outline-none"
          />
          {state.fieldErrors?.subjectTemplate && (
            <p className="mt-1 text-xs text-red-400">
              {state.fieldErrors.subjectTemplate[0]}
            </p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-400">
            Body template
          </label>
          <textarea
            name="bodyTemplate"
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={"Hi {{first_name}},\n\n…"}
            className="w-full resize-none rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-indigo-500 focus:outline-none"
          />
          {state.fieldErrors?.bodyTemplate && (
            <p className="mt-1 text-xs text-red-400">
              {state.fieldErrors.bodyTemplate[0]}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
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
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-300 transition-colors hover:bg-neutral-700"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
