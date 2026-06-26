function Bone({ className }: { className?: string }) {
  return <div className={`rounded-[var(--r-md)] bg-[var(--surface-2)] ${className ?? ""}`} />;
}

function FunnelRow({ widthPct }: { widthPct: number }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <Bone className="h-4 w-24 shrink-0" />
      <div className="flex-1">
        <div className="h-1.5 rounded-full bg-[var(--surface-1)]">
          <div
            className="h-1.5 rounded-full bg-[var(--surface-3)]"
            style={{ width: `${widthPct}%` }}
          />
        </div>
      </div>
      <Bone className="h-4 w-8 shrink-0" />
    </div>
  );
}

export default function AnalyticsLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Bone className="h-6 w-24" />
          <Bone className="mt-2 h-4 w-72" />
        </div>
        <div className="flex gap-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <Bone key={i} className="h-8 w-14 rounded-[var(--r-md)]" />
          ))}
        </div>
      </div>

      {/* 4 stat cards — @container @sm:grid-cols-2 @xl:grid-cols-4 */}
      <div className="@container">
        <div className="grid grid-cols-1 gap-4 @sm:grid-cols-2 @xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card px-5 py-4">
              <Bone className="h-3 w-24" />
              <Bone className="mt-3 h-8 w-20" />
              <Bone className="mt-2 h-3 w-32" />
            </div>
          ))}
        </div>
      </div>

      {/* Stage funnel card */}
      <div className="card">
        <div className="border-b border-[var(--line-1)] px-6 py-4">
          <Bone className="h-4 w-28" />
          <Bone className="mt-1 h-3 w-52" />
        </div>
        <div className="divide-y divide-[var(--line-1)]">
          {[70, 55, 42, 30, 20, 8].map((w, i) => (
            <FunnelRow key={i} widthPct={w} />
          ))}
        </div>
      </div>

      {/* Won deals per month card */}
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
                <div className="h-1.5 rounded-full bg-[var(--surface-1)]">
                  <div
                    className="h-1.5 rounded-full bg-[var(--surface-3)]"
                    style={{ width: `${w}%` }}
                  />
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
                <div
                  className="flex-1 rounded-t bg-[var(--surface-3)]"
                  style={{ height: `${h}%` }}
                />
                <div
                  className="flex-1 rounded-t bg-[var(--surface-2)]"
                  style={{ height: `${Math.round(h * 0.6)}%` }}
                />
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
        {/* Status distribution */}
        <div className="card">
          <div className="border-b border-[var(--line-1)] px-6 py-4">
            <Bone className="h-4 w-36" />
            <Bone className="mt-1 h-3 w-48" />
          </div>
          <div className="divide-y divide-[var(--line-1)]">
            {[80, 55, 35, 20].map((w, i) => (
              <FunnelRow key={i} widthPct={w} />
            ))}
          </div>
        </div>

        {/* Source breakdown */}
        <div className="card">
          <div className="border-b border-[var(--line-1)] px-6 py-4">
            <Bone className="h-4 w-32" />
            <Bone className="mt-1 h-3 w-44" />
          </div>
          <div className="divide-y divide-[var(--line-1)]">
            {[65, 50, 40, 28, 15].map((w, i) => (
              <FunnelRow key={i} widthPct={w} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
