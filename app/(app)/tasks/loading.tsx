function Bone({ className }: { className?: string }) {
  return <div className={`rounded-[var(--r-md)] bg-[var(--surface-2)] ${className ?? ""}`} />;
}

export default function TasksLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div>
        <Bone className="h-7 w-24" />
        <Bone className="mt-2 h-4 w-72 max-w-full" />
      </div>

      {/* Quick-add card */}
      <div className="card px-4 py-5 sm:px-6">
        <Bone className="mb-4 h-4 w-24" />
        <div className="flex flex-col gap-3 sm:flex-row">
          <Bone className="h-10 flex-1 rounded-[var(--r-md)]" />
          <Bone className="h-10 w-32 rounded-[var(--r-md)]" />
          <Bone className="h-10 w-24 rounded-[var(--r-md)]" />
        </div>
      </div>

      {/* Task list card */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-[var(--line-1)] px-4 py-3 sm:px-5">
          <Bone className="h-2 w-2 rounded-full" />
          <Bone className="h-3 w-20" />
          <Bone className="ml-auto h-3 w-6" />
        </div>
        <div className="divide-y divide-[var(--line-1)] px-4 sm:px-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex min-h-[44px] items-center gap-3 py-2">
              <Bone className="h-4 w-4 shrink-0 rounded" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Bone className="h-4 w-2/3 max-w-full" />
                <Bone className="h-3 w-1/3 max-w-full" />
              </div>
              <Bone className="h-3 w-12 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
