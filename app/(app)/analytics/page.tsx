import { Suspense } from "react";
import { TimeRangeFilter } from "./time-range-filter";
import AnalyticsBody from "./analytics-body";

const VALID_DAYS = ["7", "30", "90"] as const;

function Bone({ className }: { className?: string }) {
  return <div className={`rounded-[var(--r-md)] bg-[var(--surface-2)] ${className ?? ""}`} />;
}

// Status/Source contact rows: label + bar + single trailing count (matches the
// loaded status/source rows — w-24 label, w-8 count, px-6 on wide containers).
function FunnelRowSkeleton({ widthPct }: { widthPct: number }) {
  return (
    <div className="flex items-center gap-4 px-6 py-3">
      <Bone className="h-4 w-24 shrink-0" />
      <div className="flex-1">
        <div className="h-1.5 rounded-full bg-[var(--surface-2)]">
          <div className="h-1.5 rounded-full bg-[var(--surface-3)]" style={{ width: `${widthPct}%` }} />
        </div>
      </div>
      <Bone className="h-4 w-8 shrink-0" />
    </div>
  );
}

// Stage funnel rows: w-28 label + bar + three trailing columns (Deals w-10,
// Value w-28, Conv. Rate w-24) to mirror the loaded funnel structure.
function StageFunnelRowSkeleton({ widthPct }: { widthPct: number }) {
  return (
    <div className="flex items-center gap-4 px-6 py-3">
      <div className="flex w-28 shrink-0 items-center gap-2">
        <div className="h-2 w-2 shrink-0 rounded-full bg-[var(--surface-3)]" />
        <Bone className="h-4 w-16" />
      </div>
      <div className="flex-1">
        <div className="h-1.5 rounded-full bg-[var(--surface-2)]">
          <div className="h-1.5 rounded-full bg-[var(--surface-3)]" style={{ width: `${widthPct}%` }} />
        </div>
      </div>
      <div className="flex w-10 shrink-0 justify-end"><Bone className="h-4 w-5" /></div>
      <div className="flex w-28 shrink-0 justify-end"><Bone className="h-4 w-16" /></div>
      <div className="flex w-24 shrink-0 justify-end"><Bone className="h-4 w-10" /></div>
    </div>
  );
}

function AnalyticsBodySkeleton() {
  return (
    <>
      {/* Mobile (<lg): 2-col summary tiles — matches MobileAnalyticsTiles so the
          phone never paints a desktop shape then snaps to the tile grid. */}
      <div className="lg:hidden">
        <div className="grid grid-cols-2 gap-3 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card flex flex-col items-start p-3">
              <Bone className="h-3 w-16" />
              <Bone className="mt-1 h-7 w-20" />
              <Bone className="mt-0.5 h-3 w-24" />
            </div>
          ))}
        </div>
      </div>

      {/* Desktop (lg+): full charts and tables */}
      <div className="hidden space-y-8 lg:block animate-pulse">
      {/* 4 stat cards */}
      <div className="@container">
        <div className="grid grid-cols-1 gap-4 @sm:grid-cols-2 @xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card px-5 py-4">
              <Bone className="h-3 w-24" />
              <Bone className="mt-2 h-8 w-20" />
              <Bone className="mt-1 h-3 w-32" />
            </div>
          ))}
        </div>
      </div>

      {/* Stage funnel */}
      <div className="card">
        <div className="border-b border-[var(--line-1)] px-5 py-3">
          <Bone className="h-4 w-28" />
          <Bone className="mt-0.5 h-3 w-72" />
        </div>
        {/* Column header strip */}
        <div className="flex items-center gap-4 border-b border-[var(--line-1)] px-6 py-2">
          <Bone className="h-3 w-12 shrink-0" />
          <div className="flex-1" />
          <div className="flex w-10 shrink-0 justify-end"><Bone className="h-3 w-8" /></div>
          <div className="flex w-28 shrink-0 justify-end"><Bone className="h-3 w-10" /></div>
          <div className="flex w-24 shrink-0 justify-end"><Bone className="h-3 w-14" /></div>
        </div>
        <div className="divide-y divide-[var(--line-1)]">
          {[70, 55, 42, 30, 20, 8].map((w, i) => (
            <StageFunnelRowSkeleton key={i} widthPct={w} />
          ))}
        </div>
      </div>

      {/* Won deals per month */}
      <div className="card">
        <div className="border-b border-[var(--line-1)] px-6 py-4">
          <Bone className="h-4 w-40" />
          <Bone className="mt-1 h-3 w-48" />
        </div>
        <div className="divide-y divide-[var(--line-1)]">
          {[40, 65, 30, 80, 50, 20].map((w, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-3">
              <Bone className="h-4 w-24 shrink-0" />
              <div className="flex-1">
                <div className="h-1.5 rounded-full bg-[var(--surface-2)]">
                  <div className="h-1.5 rounded-full bg-[var(--surface-3)]" style={{ width: `${w}%` }} />
                </div>
              </div>
              <Bone className="h-4 w-6 shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* Expected Revenue section header */}
      <div>
        <Bone className="h-6 w-40" />
        <Bone className="mt-2 h-4 w-80" />
      </div>

      {/* Forecast bar chart card */}
      <div className="card">
        <div className="border-b border-[var(--line-1)] px-6 py-4">
          <Bone className="h-4 w-36" />
          <Bone className="mt-1 h-3 w-60" />
        </div>
        <div className="flex items-end gap-2 overflow-hidden px-6 pb-4 pt-6 sm:gap-4">
          {[55, 70, 40, 85, 60, 45].map((h, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex h-32 w-full items-end justify-center gap-1">
                <div className="flex-1 rounded-t bg-[var(--surface-3)]" style={{ height: `${h}%` }} />
                <div className="flex-1 rounded-t bg-[var(--surface-2)]" style={{ height: `${Math.round(h * 0.6)}%` }} />
              </div>
              <Bone className="h-3 w-10" />
            </div>
          ))}
        </div>
      </div>

      {/* Contacts section header */}
      <div>
        <Bone className="h-6 w-24" />
        <Bone className="mt-2 h-4 w-60" />
      </div>

      {/* Status + Source 2-col grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {[4, 5].map((rows, ci) => (
          <div key={ci} className="card">
            <div className="border-b border-[var(--line-1)] px-6 py-4">
              <Bone className="h-4 w-36" />
              <Bone className="mt-1 h-3 w-48" />
            </div>
            <div className="divide-y divide-[var(--line-1)]">
              {Array.from({ length: rows }).map((_, i) => (
                <FunnelRowSkeleton key={i} widthPct={70 - i * 14} />
              ))}
            </div>
          </div>
        ))}
      </div>
      </div>
    </>
  );
}

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days } = await searchParams;
  const validDays =
    days && (VALID_DAYS as readonly string[]).includes(days) ? days : "";

  return (
    <div className="space-y-8">
      {/* Header — renders immediately before DB queries start */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-title2 font-semibold text-[var(--ink-1)]">Analytics</h2>
          <p className="text-body mt-1 text-[var(--ink-2)]">
            Pipeline performance and deal conversion metrics.
          </p>
        </div>
        <TimeRangeFilter current={validDays} />
      </div>

      {/* Heavy analytics data streams in behind a Suspense boundary */}
      <Suspense fallback={<AnalyticsBodySkeleton />}>
        <AnalyticsBody days={validDays} />
      </Suspense>
    </div>
  );
}
