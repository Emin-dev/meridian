function Bone({ className }: { className?: string }) {
  return <div className={`rounded-[--r-md] bg-[--surface-2] ${className ?? ""}`} />;
}

export default function SequencesLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header — wraps on mobile */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Bone className="h-7 w-32" />
          <Bone className="mt-2 h-4 w-64 max-w-full" />
        </div>
        <Bone className="h-10 w-32 self-start rounded-[--r-md] sm:self-auto" />
      </div>

      {/* Due steps card */}
      <div className="card px-4 py-5 sm:px-6">
        <Bone className="mb-4 h-4 w-28" />
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Bone className="h-4 w-1/2 max-w-full" />
              <Bone className="h-3 w-2/3 max-w-full" />
            </div>
          ))}
        </div>
      </div>

      {/* All sequences card */}
      <div className="card overflow-hidden">
        <div className="border-b border-[--line-1] px-4 py-3">
          <Bone className="h-3 w-28" />
        </div>
        <div className="divide-y divide-[--line-1]">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5">
              <div className="min-w-0 flex-1 space-y-2">
                <Bone className="h-4 w-40 max-w-full" />
                <div className="flex flex-wrap gap-2">
                  <Bone className="h-5 w-16 rounded-[--r-pill]" />
                  <Bone className="h-4 w-14" />
                  <Bone className="h-4 w-20" />
                </div>
              </div>
              <Bone className="h-8 w-16 shrink-0 rounded-[--r-md]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
