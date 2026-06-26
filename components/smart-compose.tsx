"use client";

import { useCallback, useId, useState, useTransition } from "react";
import { smartCompose } from "@/app/(app)/activity/actions";
import { useOverlayDismiss } from "@/hooks/use-overlay-dismiss";

interface Props {
  /** Optional activity type ("email", "call", …) to tune tone. */
  type?: string;
  /** Called when the user accepts a draft, so the parent can use the text. */
  onAccept: (draft: string) => void;
  /** Optional label override for the trigger. */
  triggerLabel?: string;
  className?: string;
}

const inputCls =
  "w-full rounded-[--r-md] border border-[--line-1] bg-[--surface-2] px-3 py-2 text-body text-[--ink-1] placeholder:text-[--ink-3] focus:border-[--accent] focus:outline-none [color-scheme:dark]";

/**
 * Smart compose — turn a short intent into a polished, editable draft via AI.
 * Graceful when no API key is configured. Apple-minimal, mobile-first.
 */
export default function SmartCompose({
  type,
  onAccept,
  triggerLabel = "Smart compose",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState("");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [noKey, setNoKey] = useState(false);
  const [isPending, startTransition] = useTransition();
  const intentId = useId();
  const draftId = useId();

  const reset = useCallback(() => {
    setIntent("");
    setDraft("");
    setError(null);
    setNoKey(false);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    reset();
  }, [reset]);

  // Escape / focus-trap parity for this inline overlay (reuse shared convention).
  const panelRef = useOverlayDismiss<HTMLDivElement>(open, close);

  function handleGenerate() {
    setError(null);
    setNoKey(false);
    startTransition(async () => {
      const result = await smartCompose(intent, type);
      if (result.noKey) {
        setNoKey(true);
      } else if (result.error) {
        setError(result.error);
      } else if (result.draft) {
        setDraft(result.draft);
      }
    });
  }

  function handleUse() {
    onAccept(draft.trim());
    setOpen(false);
    reset();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`tap press inline-flex items-center gap-1.5 rounded-[--r-md] border border-[--line-1] bg-[--surface-1] px-3 text-footnote font-medium text-[--ink-2] transition-colors hover:border-[--line-2] hover:text-[--ink-1] ${className ?? ""}`}
      >
        <SparkleIcon />
        {triggerLabel}
      </button>
    );
  }

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      className="space-y-3 rounded-[--r-md] border border-[--line-1] bg-[--surface-2] p-3 outline-none"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 text-footnote font-medium text-[--ink-1]">
          <SparkleIcon />
          <span className="truncate">Smart compose</span>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Close smart compose"
          className="tap -mr-2 -mt-2 -mb-2 inline-flex items-center justify-center text-[--ink-3] hover:text-[--ink-1]"
        >
          <CloseIcon />
        </button>
      </div>

      <div>
        <label htmlFor={intentId} className="mb-1 block text-caption font-medium text-[--ink-2]">
          What do you want to say?
        </label>
        <textarea
          id={intentId}
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          rows={2}
          placeholder="e.g. thank them for the demo and propose a follow-up next week"
          className={`${inputCls} resize-none`}
        />
      </div>

      {noKey && (
        <p className="text-caption text-[--warn]">
          Set{" "}
          <code className="rounded bg-[--surface-3] px-1 py-0.5">DEEPSEEK_API_KEY</code>{" "}
          in your environment to enable AI drafting.
        </p>
      )}

      {error && <p className="text-caption text-[--bad]">{error}</p>}

      {draft ? (
        <div className="space-y-2">
          <label htmlFor={draftId} className="block text-caption font-medium text-[--ink-2]">
            Draft <span className="font-normal text-[--ink-3]">(edit before using)</span>
          </label>
          <textarea
            id={draftId}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={5}
            className={`${inputCls} resize-y`}
          />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isPending || !intent.trim()}
              className="tap press inline-flex items-center justify-center rounded-[--r-md] border border-[--line-1] bg-[--surface-1] px-3 text-footnote font-medium text-[--ink-2] transition-colors hover:border-[--line-2] hover:text-[--ink-1] disabled:opacity-50"
            >
              {isPending ? "Redrafting…" : "Redraft"}
            </button>
            <button
              type="button"
              onClick={handleUse}
              disabled={!draft.trim()}
              className="tap press inline-flex items-center justify-center rounded-[--r-md] bg-[--accent] px-4 text-footnote font-medium text-[--accent-ink] transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
            >
              Use draft
            </button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isPending || !intent.trim()}
            className="tap press inline-flex items-center justify-center rounded-[--r-md] bg-[--accent] px-4 text-footnote font-medium text-[--accent-ink] transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
          >
            {isPending ? "Drafting…" : "Draft message"}
          </button>
        </div>
      )}
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M12 3v4M12 17v4M5 12H3M21 12h-2M6.3 6.3 4.9 4.9M19.1 19.1l-1.4-1.4M17.7 6.3l1.4-1.4M4.9 19.1l1.4-1.4" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
