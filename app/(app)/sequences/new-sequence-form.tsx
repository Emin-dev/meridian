"use client";

import { useState, useActionState, useTransition } from "react";
import Link from "next/link";
import {
  createSequence,
  generateSequenceWithAI,
  type SequenceFormState,
} from "./actions";

interface Step {
  delayDays: number;
  subjectTemplate: string;
  bodyTemplate: string;
}

const defaultStep = (): Step => ({ delayDays: 0, subjectTemplate: "", bodyTemplate: "" });
const initialState: SequenceFormState = {};

export default function NewSequenceForm() {
  const [state, formAction, pending] = useActionState(createSequence, initialState);
  const [steps, setSteps] = useState<Step[]>([defaultStep()]);
  const [seqName, setSeqName] = useState("");

  const [goal, setGoal] = useState("");
  const [showAI, setShowAI] = useState(true);
  const [aiError, setAiError] = useState("");
  const [aiFilled, setAiFilled] = useState(false);
  const [aiPending, startAiTransition] = useTransition();

  function updateStep(index: number, field: keyof Step, value: string | number) {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  }

  function addStep() {
    if (steps.length < 5) setSteps((prev) => [...prev, defaultStep()]);
  }

  function removeStep(index: number) {
    if (steps.length > 1) setSteps((prev) => prev.filter((_, i) => i !== index));
  }

  function handleGenerate() {
    if (!goal.trim()) return;
    setAiError("");
    setAiFilled(false);
    startAiTransition(async () => {
      const result = await generateSequenceWithAI(goal.trim());
      if (result.error) {
        setAiError(result.error);
      } else if (result.name && result.steps) {
        setSeqName(result.name);
        setSteps(result.steps);
        setAiFilled(true);
        setShowAI(false);
      }
    });
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/sequences"
          className="text-body text-[--ink-2] transition-colors hover:text-[--ink-1]"
        >
          &larr; Sequences
        </Link>
        <span className="text-[--ink-3]">/</span>
        <h2 className="text-body font-semibold text-[--ink-1]">New Sequence</h2>
      </div>

      {/* AI generation panel */}
      <div className="rounded-[--r-lg] border border-[--accent-tint] bg-[--accent-tint]/30 p-4 sm:p-5 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-body font-semibold text-[--accent]">Generate with AI</h3>
            <p className="text-footnote text-[--ink-2] mt-0.5">
              Describe your goal and DeepSeek will draft the full sequence for you.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAI((v) => !v)}
            className="tap self-start flex items-center justify-center rounded-[--r-md] px-3 text-xs font-medium text-[--accent] transition-colors hover:opacity-80 sm:self-auto"
          >
            {showAI ? "Hide" : "Show"}
          </button>
        </div>

        {showAI && (
          <div className="space-y-3 pt-1">
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={3}
              placeholder="e.g. cold outreach to SaaS founders, 3 steps"
              className="w-full resize-y rounded-[--r-md] border border-[--accent-tint] bg-[--surface-2] px-3 py-2 text-body text-[--ink-1] placeholder-[--ink-3] focus:border-[--accent] focus:outline-none"
            />
            {aiError && <p className="text-xs text-[--bad]">{aiError}</p>}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={aiPending || !goal.trim()}
              className="tap flex items-center justify-center rounded-[--r-md] bg-[--accent] px-4 text-body font-medium text-[--accent-ink] press hover:bg-[--accent-hover] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {aiPending ? "Generating…" : "Generate sequence"}
            </button>
          </div>
        )}
      </div>

      {aiFilled && (
        <div className="rounded-[--r-md] border border-[--ok-tint] bg-[--ok-tint]/30 px-4 py-3 text-body text-[--ok]">
          Sequence drafted by AI &mdash; review and edit below, then save.
        </div>
      )}

      {state.noDb && (
        <div className="rounded-[--r-md] border border-[--warn-tint] bg-[--warn-tint]/30 px-4 py-3 text-body text-[--warn]">
          Database not connected. Set{" "}
          <code className="rounded bg-[--surface-2] px-1 py-0.5 text-footnote">DATABASE_URL</code> to
          save sequences.
        </div>
      )}

      <form action={formAction} className="space-y-5">
        {/* Sequence details */}
        <div className="card p-4 sm:p-5 space-y-4">
          <h3 className="text-body font-semibold text-[--ink-1]">Sequence details</h3>

          <div>
            <label
              htmlFor="seq-name"
              className="mb-1 block text-footnote font-medium text-[--ink-2]"
            >
              Name <span className="text-[--bad]">*</span>
            </label>
            <input
              id="seq-name"
              name="name"
              type="text"
              required
              placeholder="Welcome sequence"
              value={seqName}
              onChange={(e) => setSeqName(e.target.value)}
              className="tap w-full rounded-[--r-md] border border-[--line-1] bg-[--surface-2] px-3 text-body text-[--ink-1] placeholder-[--ink-3] focus:border-[--accent] focus:outline-none"
            />
            {state.fieldErrors?.["name"] && (
              <p className="mt-1 text-xs text-[--bad]">{state.fieldErrors["name"][0]}</p>
            )}
          </div>
        </div>

        {/* Steps */}
        <div className="card p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-body font-semibold text-[--ink-1]">
              Steps{" "}
              <span className="ml-1 text-footnote font-normal text-[--ink-3]">
                ({steps.length}/5)
              </span>
            </h3>
            <button
              type="button"
              onClick={addStep}
              disabled={steps.length >= 5}
              className="tap flex items-center justify-center rounded-[--r-md] px-3 text-xs font-medium text-[--accent] transition-colors hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
            >
              + Add step
            </button>
          </div>

          <div className="space-y-3">
            {steps.map((step, i) => (
              <div
                key={i}
                className="rounded-[--r-md] border border-[--line-1] bg-[--surface-2] p-4 space-y-3"
              >
                {/* Step header */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-caption font-semibold uppercase tracking-wide text-[--ink-2]">
                    Step {i + 1}
                  </span>
                  {steps.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeStep(i)}
                      className="tap flex items-center justify-center rounded-[--r-md] px-3 text-xs text-[--ink-3] transition-colors hover:text-[--bad]"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {/* Delay */}
                <div>
                  <label className="mb-1 block text-footnote font-medium text-[--ink-3]">
                    Send after (days)
                  </label>
                  <input
                    name={`step_${i}_delay`}
                    type="number"
                    min="0"
                    value={step.delayDays}
                    onChange={(e) =>
                      updateStep(i, "delayDays", Math.max(0, parseInt(e.target.value, 10) || 0))
                    }
                    className="tap w-28 rounded-[--r-md] border border-[--line-1] bg-[--surface-1] px-3 text-body text-[--ink-1] focus:border-[--accent] focus:outline-none [color-scheme:dark]"
                  />
                  {state.fieldErrors?.[`step_${i}_delay`] && (
                    <p className="mt-1 text-xs text-[--bad]">
                      {state.fieldErrors[`step_${i}_delay`][0]}
                    </p>
                  )}
                </div>

                {/* Subject template */}
                <div>
                  <label className="mb-1 block text-footnote font-medium text-[--ink-3]">
                    Subject template <span className="text-[--bad]">*</span>
                  </label>
                  <input
                    name={`step_${i}_subject`}
                    type="text"
                    placeholder="Hi {{firstName}}, quick question…"
                    value={step.subjectTemplate}
                    onChange={(e) => updateStep(i, "subjectTemplate", e.target.value)}
                    className="tap w-full rounded-[--r-md] border border-[--line-1] bg-[--surface-1] px-3 text-body text-[--ink-1] placeholder-[--ink-3] focus:border-[--accent] focus:outline-none"
                  />
                  {state.fieldErrors?.[`step_${i}_subject`] && (
                    <p className="mt-1 text-xs text-[--bad]">
                      {state.fieldErrors[`step_${i}_subject`][0]}
                    </p>
                  )}
                </div>

                {/* Body template */}
                <div>
                  <label className="mb-1 block text-footnote font-medium text-[--ink-3]">
                    Body template <span className="text-[--bad]">*</span>
                  </label>
                  <textarea
                    name={`step_${i}_body`}
                    rows={4}
                    placeholder={`Hi {{firstName}},\n\n`}
                    value={step.bodyTemplate}
                    onChange={(e) => updateStep(i, "bodyTemplate", e.target.value)}
                    className="w-full resize-y rounded-[--r-md] border border-[--line-1] bg-[--surface-1] px-3 py-2 text-body text-[--ink-1] placeholder-[--ink-3] focus:border-[--accent] focus:outline-none"
                  />
                  {state.fieldErrors?.[`step_${i}_body`] && (
                    <p className="mt-1 text-xs text-[--bad]">
                      {state.fieldErrors[`step_${i}_body`][0]}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {state.error && (
            <p className="text-xs text-[--bad]">{state.error}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            href="/sequences"
            className="tap flex items-center justify-center rounded-[--r-md] border border-[--line-1] px-4 text-body text-[--ink-2] transition-colors hover:bg-[--surface-2] hover:text-[--ink-1]"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={pending}
            className="tap flex items-center justify-center rounded-[--r-md] bg-[--accent] px-4 text-body font-medium text-[--accent-ink] press hover:bg-[--accent-hover] disabled:opacity-50"
          >
            {pending ? "Creating…" : "Create sequence"}
          </button>
        </div>
      </form>
    </div>
  );
}
