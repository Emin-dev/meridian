function Bone({ className }: { className?: string }) {
  return <div className={`rounded-[--r-md] bg-[--surface-2] ${className ?? ""}`} />;
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
        <div className="flex gap-2">
          <Bone className="h-10 w-24 rounded-[--r-md]" />
          <Bone className="h-10 w-28 rounded-[--r-md]" />
        </div>
      </div>

      {/* Segment chips */}
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Bone key={i} className="h-8 w-20 rounded-[--r-pill]" />
        ))}
      </div>

      {/* Contacts table */}
      <div className="card">
        <div className="border-b border-[--line-1] px-5 py-3">
          <Bone className="h-3 w-24" />
        </div>
        <div className="divide-y divide-[--line-1]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex min-w-0 gap-4 overflow-hidden px-5 py-3.5">
              <Bone className="h-4 w-28 shrink-0" />
              <Bone className="h-4 w-36 shrink-0" />
              <Bone className="h-4 w-24 shrink-0" />
              <Bone className="h-4 w-20 shrink-0" />
              <Bone className="h-5 w-14 shrink-0 rounded-[--r-pill]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
