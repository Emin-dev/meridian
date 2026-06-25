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

  // AI generation state
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
          className="text-sm text-neutral-400 transition-colors hover:text-neutral-100"
        >
          &larr; Sequences
        </Link>
        <span className="text-neutral-700">/</span>
        <h2 className="text-sm font-semibold text-neutral-100">New Sequence</h2>
      </div>

      {/* AI generation panel */}
      <div className="rounded-xl border border-indigo-800/50 bg-indigo-950/20 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-indigo-300">Generate with AI</h3>
            <p className="text-xs text-indigo-400/70 mt-0.5">
              Describe your goal and DeepSeek will draft the full sequence for you.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAI((v) => !v)}
            className="text-xs font-medium text-indigo-400 transition-colors hover:text-indigo-300"
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
              className="w-full resize-y rounded-lg border border-indigo-700/50 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-indigo-500 focus:outline-none"
            />
            {aiError && <p className="text-xs text-red-400">{aiError}</p>}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={aiPending || !goal.trim()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {aiPending ? "Generating…" : "Generate sequence"}
            </button>
          </div>
        )}
      </div>

      {aiFilled && (
        <div className="rounded-lg border border-green-700/50 bg-green-900/20 px-4 py-3 text-sm text-green-300">
          Sequence drafted by AI &mdash; review and edit below, then save.
        </div>
      )}

      {state.noDb && (
        <div className="rounded-lg border border-amber-700/50 bg-amber-900/20 px-4 py-3 text-sm text-amber-300">
          Database not connected. Set{" "}
          <code className="rounded bg-neutral-800 px-1 py-0.5 text-xs">DATABASE_URL</code> to
          save sequences.
        </div>
      )}

      <form action={formAction} className="space-y-5">
        {/* Sequence details */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-neutral-200">Sequence details</h3>

          <div>
            <label
              htmlFor="seq-name"
              className="mb-1 block text-xs font-medium text-neutral-400"
            >
              Name <span className="text-red-400">*</span>
            </label>
            <input
              id="seq-name"
              name="name"
              type="text"
              required
              placeholder="Welcome sequence"
              value={seqName}
              onChange={(e) => setSeqName(e.target.value)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-indigo-500 focus:outline-none"
            />
            {state.fieldErrors?.["name"] && (
              <p className="mt-1 text-xs text-red-400">{state.fieldErrors["name"][0]}</p>
            )}
          </div>
        </div>

        {/* Steps */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-200">
              Steps{" "}
              <span className="ml-1 text-xs font-normal text-neutral-500">
                ({steps.length}/5)
              </span>
            </h3>
            <button
              type="button"
              onClick={addStep}
              disabled={steps.length >= 5}
              className="text-xs font-medium text-indigo-400 transition-colors hover:text-indigo-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              + Add step
            </button>
          </div>

          <div className="space-y-3">
            {steps.map((step, i) => (
              <div
                key={i}
                className="rounded-lg border border-neutral-700 bg-neutral-800/40 p-4 space-y-3"
              >
                {/* Step header */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
                    Step {i + 1}
                  </span>
                  {steps.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeStep(i)}
                      className="text-xs text-neutral-600 transition-colors hover:text-red-400"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {/* Delay */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-500">
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
                    className="w-28 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:border-indigo-500 focus:outline-none"
                  />
                  {state.fieldErrors?.[`step_${i}_delay`] && (
                    <p className="mt-1 text-xs text-red-400">
                      {state.fieldErrors[`step_${i}_delay`][0]}
                    </p>
                  )}
                </div>

                {/* Subject template */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-500">
                    Subject template <span className="text-red-400">*</span>
                  </label>
                  <input
                    name={`step_${i}_subject`}
                    type="text"
                    placeholder="Hi {{first_name}}, quick question…"
                    value={step.subjectTemplate}
                    onChange={(e) => updateStep(i, "subjectTemplate", e.target.value)}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-indigo-500 focus:outline-none"
                  />
                  {state.fieldErrors?.[`step_${i}_subject`] && (
                    <p className="mt-1 text-xs text-red-400">
                      {state.fieldErrors[`step_${i}_subject`][0]}
                    </p>
                  )}
                </div>

                {/* Body template */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-500">
                    Body template <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    name={`step_${i}_body`}
                    rows={4}
                    placeholder={`Hi {{first_name}},\n\n`}
                    value={step.bodyTemplate}
                    onChange={(e) => updateStep(i, "bodyTemplate", e.target.value)}
                    className="w-full resize-y rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-indigo-500 focus:outline-none"
                  />
                  {state.fieldErrors?.[`step_${i}_body`] && (
                    <p className="mt-1 text-xs text-red-400">
                      {state.fieldErrors[`step_${i}_body`][0]}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {state.error && (
            <p className="text-xs text-red-400">{state.error}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Link
            href="/sequences"
            className="rounded-lg px-4 py-2 text-sm text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-100"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
          >
            {pending ? "Creating…" : "Create sequence"}
          </button>
        </div>
      </form>
    </div>
  );
}
