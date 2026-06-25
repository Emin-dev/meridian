"use client";

import { useState, useTransition } from "react";
import { draftOutreachEmail, type DraftEmailState } from "../actions";

interface Props {
  contactId: number;
}

export default function DraftEmailPanel({ contactId }: Props) {
  const [result, setResult] = useState<DraftEmailState>({});
  const [draftText, setDraftText] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleDraft() {
    startTransition(async () => {
      const r = await draftOutreachEmail(contactId);
      setResult(r);
      if (r.draft) setDraftText(r.draft);
    });
  }

  const textareaCls =
    "w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-indigo-500 focus:outline-none resize-none leading-relaxed";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-neutral-300">AI outreach email</h3>
        <button
          type="button"
          onClick={handleDraft}
          disabled={isPending}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
        >
          {isPending ? "Drafting…" : draftText ? "Re-draft" : "Draft email"}
        </button>
      </div>

      {result.noDb && (
        <p className="text-xs text-neutral-400">
          Database not connected — cannot load contact data.
        </p>
      )}

      {result.noKey && (
        <p className="text-xs text-amber-400">
          Set{" "}
          <code className="rounded bg-neutral-800 px-1 py-0.5">
            DEEPSEEK_API_KEY
          </code>{" "}
          in your environment to enable AI email drafting.
        </p>
      )}

      {result.error && (
        <p className="text-xs text-red-400">{result.error}</p>
      )}

      {draftText ? (
        <div className="space-y-1.5">
          <p className="text-xs text-neutral-500">
            Edit the draft below before sending.
          </p>
          <textarea
            rows={10}
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            className={textareaCls}
          />
        </div>
      ) : (
        !result.noDb &&
        !result.noKey &&
        !result.error &&
        !isPending && (
          <p className="text-xs text-neutral-500">
            Click &ldquo;Draft email&rdquo; to generate a personalized AI outreach email using this contact&apos;s details.
          </p>
        )
      )}
    </div>
  );
}
