function Bone({ className }: { className?: string }) {
  return <div className={`rounded-[var(--r-md)] bg-[var(--surface-2)] ${className ?? ""}`} />;
}

export default function ActivityLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div>
        <Bone className="h-7 w-24" />
        <Bone className="mt-2 h-4 w-60" />
      </div>

      {/* Log form card */}
      <div className="card px-4 py-5 sm:px-6">
        <Bone className="mb-4 h-4 w-32" />
        <div className="flex flex-col gap-3 sm:flex-row">
          <Bone className="h-10 w-28 rounded-[var(--r-md)]" />
          <Bone className="h-10 flex-1 rounded-[var(--r-md)]" />
        </div>
        <div className="mt-3">
          <Bone className="h-16 w-full rounded-[var(--r-md)]" />
        </div>
        <div className="mt-3 flex justify-end">
          <Bone className="h-10 w-28 rounded-[var(--r-md)]" />
        </div>
      </div>

      {/* Events list */}
      <div className="card">
        <div className="border-b border-[var(--line-1)] px-5 py-3">
          <Bone className="h-3 w-24" />
        </div>
        <ul className="divide-y divide-[var(--line-1)]">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="flex gap-4 px-5 py-4">
              <Bone className="mt-0.5 h-5 w-14 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Bone className="h-4 w-3/4" />
                <Bone className="h-3 w-1/3" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
