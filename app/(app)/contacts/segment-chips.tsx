"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

const PRESETS = [
  { key: "unscored", label: "Unscored", params: { unscored: "1" } },
  { key: "hotLeads", label: "Hot leads ≥80", params: { minScore: "80" } },
  { key: "noActivity", label: "No activity 30d+", params: { noActivity: "30" } },
] as const;

interface Props {
  currentParams: Record<string, string | undefined>;
}

export default function SegmentChips({ currentParams }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function isActive(preset: (typeof PRESETS)[number]) {
    return Object.entries(preset.params).every(([k, v]) => currentParams[k] === v);
  }

  function handleClick(preset: (typeof PRESETS)[number]) {
    if (isActive(preset)) {
      startTransition(() => router.push("/contacts"));
    } else {
      const p = new URLSearchParams(preset.params as Record<string, string>);
      startTransition(() => router.push(`/contacts?${p.toString()}`));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((preset) => {
        const active = isActive(preset);
        return (
          <button
            key={preset.key}
            onClick={() => handleClick(preset)}
            disabled={isPending}
            className={[
              "tap inline-flex items-center justify-center rounded-full px-3 text-xs font-medium transition-colors disabled:opacity-50",
              active
                ? "bg-[var(--accent)] text-[var(--accent-ink)]"
                : "border border-[var(--line-1)] bg-[var(--surface-2)] text-[var(--ink-2)] hover:border-[var(--accent)] hover:text-[var(--accent)]",
            ].join(" ")}
          >
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}
