function Bone({ className }: { className?: string }) {
  return <div className={`rounded-[var(--r-md)] bg-[var(--surface-2)] ${className ?? ""}`} />;
}

export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div>
        <Bone className="h-6 w-28" />
        <Bone className="mt-2 h-4 w-40" />
      </div>

      {/* 5 KPI cards — @container matching @sm:grid-cols-2 @lg:grid-cols-3 */}
      <div className="@container">
        <div className="grid grid-cols-1 gap-4 @sm:grid-cols-2 @lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card p-4 sm:p-5">
              <Bone className="h-3 w-24" />
              <Bone className="mt-3 h-8 w-16" />
            </div>
          ))}
        </div>
      </div>

      {/* TodayAgenda slot */}
      <div className="card p-4">
        <Bone className="mb-3 h-4 w-32" />
        <div className="space-y-2">
          <Bone className="h-10 w-full rounded-[var(--r-md)]" />
          <Bone className="h-10 w-3/4 rounded-[var(--r-md)]" />
        </div>
      </div>

      {/* Pipeline chart + AI digest */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="card h-52 lg:col-span-3" />
        <div className="card h-52 lg:col-span-2" />
      </div>

      {/* Recent activity */}
      <div className="card">
        <div className="border-b border-[var(--line-1)] px-5 py-3">
          <Bone className="h-3 w-28" />
        </div>
        <ul className="divide-y divide-[var(--line-1)]">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="flex gap-4 px-5 py-4">
              <Bone className="mt-0.5 h-5 w-14 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Bone className="h-4 w-3/4" />
                <Bone className="h-3 w-1/2" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
