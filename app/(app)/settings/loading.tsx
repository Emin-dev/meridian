function Bone({ className }: { className?: string }) {
  return <div className={`rounded-[--r-md] bg-[--surface-2] ${className ?? ""}`} />;
}

export default function SettingsLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Header */}
      <div>
        <Bone className="h-6 w-28" />
        <Bone className="mt-2 h-4 w-60" />
      </div>

      {/* Account card */}
      <div className="card p-4 sm:p-5 space-y-3">
        <Bone className="h-4 w-24" />
        <div className="flex items-center gap-3">
          <Bone className="h-10 w-10 shrink-0 rounded-full" />
          <div className="space-y-2">
            <Bone className="h-4 w-48" />
            <Bone className="h-3 w-20" />
          </div>
        </div>
      </div>

      {/* Connection health card */}
      <div className="card p-4 sm:p-5">
        <Bone className="mb-4 h-4 w-40" />
        <div className="divide-y divide-[--line-1]">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0 space-y-2">
                <Bone className="h-4 w-32" />
                <Bone className="h-3 w-52" />
              </div>
              <Bone className="h-4 w-24 shrink-0 rounded-[--r-pill]" />
            </div>
          ))}
        </div>
      </div>

      {/* CRM preferences card */}
      <div className="card p-4 sm:p-5 space-y-4">
        <div className="space-y-2">
          <Bone className="h-4 w-36" />
          <Bone className="h-3 w-72" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Bone className="h-3 w-28" />
            <Bone className="h-10 w-full rounded-[--r-md]" />
          </div>
        ))}
      </div>

      {/* Demo data card */}
      <div className="card p-4 sm:p-5 space-y-4">
        <div className="space-y-2">
          <Bone className="h-4 w-28" />
          <Bone className="h-3 w-full max-w-md" />
        </div>
        <Bone className="h-10 w-32 rounded-[--r-md]" />
      </div>
    </div>
  );
}
