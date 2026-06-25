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
    <div className="flex shrink-0 gap-1 rounded-lg border border-neutral-800 bg-neutral-900 p-1">
      {RANGES.map((r) => (
        <button
          key={r.value || "all"}
          onClick={() => select(r.value)}
          className={`tap flex items-center justify-center rounded px-3 py-1 text-sm font-medium transition-colors ${
            current === r.value
              ? "bg-neutral-700 text-neutral-100"
              : "text-neutral-400 hover:text-neutral-200"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
