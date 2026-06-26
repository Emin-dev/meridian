function Bone({ className }: { className?: string }) {
  return <div className={`rounded-[var(--r-md)] bg-[var(--surface-2)] ${className ?? ""}`} />;
}

export default function ContactsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header — wraps on mobile */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Bone className="h-6 w-28" />
          <Bone className="mt-2 h-4 w-52" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Bone className="h-10 w-24 rounded-[var(--r-md)]" />
          <Bone className="h-10 w-28 rounded-[var(--r-md)]" />
          <Bone className="h-10 w-24 rounded-[var(--r-md)]" />
          <Bone className="h-10 w-28 rounded-[var(--r-md)]" />
        </div>
      </div>

      {/* Segment chips */}
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Bone key={i} className="h-8 w-20 rounded-[var(--r-pill)]" />
        ))}
      </div>

      {/* Contacts list — mirrors the real full-width wrapper */}
      <div className="border-y border-[var(--line-1)] bg-[var(--surface-1)] sm:rounded-xl sm:border">
        <div className="flex items-center justify-between border-b border-[var(--line-1)] px-5 py-3">
          <Bone className="h-3 w-24" />
        </div>
        <div className="divide-y divide-[var(--line-1)]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5">
              <Bone className="h-4 w-40 max-w-[35%] shrink-0" />
              <Bone className="hidden h-4 w-36 shrink-0 sm:block" />
              <Bone className="hidden h-4 w-24 shrink-0 md:block" />
              <Bone className="h-5 w-14 shrink-0 rounded-[var(--r-pill)]" />
              <Bone className="ml-auto h-4 w-20 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
