function Bone({ className }: { className?: string }) {
  return <div className={`rounded bg-neutral-800 ${className ?? ""}`} />;
}

export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <Bone className="h-7 w-32" />
        <Bone className="mt-2 h-4 w-44" />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
            <Bone className="h-3 w-24" />
            <Bone className="mt-3 h-8 w-16" />
          </div>
        ))}
      </div>

      {/* Chart + digest */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3 h-52 rounded-xl border border-neutral-800 bg-neutral-900" />
        <div className="lg:col-span-2 h-52 rounded-xl border border-neutral-800 bg-neutral-900" />
      </div>

      {/* Recent activity */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900">
        <div className="border-b border-neutral-800 px-5 py-3">
          <Bone className="h-3 w-28" />
        </div>
        <ul className="divide-y divide-neutral-800">
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
