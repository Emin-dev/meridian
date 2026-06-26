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
      <div className="card overflow-hidden">
        {/* Filter bar — type chips + date range */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line-1)] px-4 py-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Bone key={i} className="h-7 w-14 rounded-[var(--r-pill)]" />
          ))}
          <Bone className="h-7 w-28 rounded-[var(--r-md)] sm:ml-auto" />
        </div>
        {/* Stacked card bones */}
        <ul className="flex flex-col gap-2 p-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <li
              key={i}
              className="flex items-start gap-3 rounded-[var(--r-lg)] border border-[var(--line-1)] bg-[var(--surface-2)] px-3 py-3"
            >
              <Bone className="h-10 w-10 shrink-0 rounded-[var(--r-md)]" />
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
