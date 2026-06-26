"use client";
import { useRouter, usePathname } from "next/navigation";

const RANGES = [
  { label: "7d", value: "7" },
  { label: "30d", value: "30" },
  { label: "90d", value: "90" },
  { label: "All", value: "" },
] as const;

export function TimeRangeFilter({ current }: { current: string }) {
  const router = useRouter();
  const pathname = usePathname();

  function select(value: string) {
    router.push(value ? `${pathname}?days=${value}` : pathname);
  }

  return (
    <div className="flex shrink-0 gap-1 rounded-lg border border-[--line-1] bg-[--surface-1] p-1">
      {RANGES.map((r) => (
        <button
          key={r.value || "all"}
          onClick={() => select(r.value)}
          className={`tap flex items-center justify-center rounded border px-3 py-1 text-callout font-medium transition-colors ${
            current === r.value
              ? "border-[--accent]/30 bg-[--accent-tint] text-[--accent]"
              : "border-transparent text-[--ink-2] hover:text-[--ink-1]"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
