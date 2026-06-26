function Bone({ className }: { className?: string }) {
  return <div className={`rounded-[--r-md] bg-[--surface-2] ${className ?? ""}`} />;
}

export default function SearchLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div>
        <Bone className="h-6 w-28" />
        <Bone className="mt-2 h-4 w-72" />
      </div>

      {/* Result tabs */}
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Bone key={i} className="h-8 w-24 rounded-[--r-pill]" />
        ))}
      </div>

      {/* Result rows */}
      <div className="card">
        <div className="divide-y divide-[--line-1]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex min-w-0 items-center gap-4 overflow-hidden px-5 py-3.5">
              <Bone className="h-9 w-9 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Bone className="h-4 w-40" />
                <Bone className="h-3 w-56" />
              </div>
              <Bone className="h-5 w-14 shrink-0 rounded-[--r-pill]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
