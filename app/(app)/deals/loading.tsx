function Bone({ className }: { className?: string }) {
  return <div className={`rounded-[--r-md] bg-[--surface-2] ${className ?? ""}`} />;
}

const STAGE_COUNT = 6;

export default function DealsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header — wraps on mobile */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Bone className="h-6 w-20" />
          <Bone className="mt-2 h-4 w-56" />
        </div>
        <div className="flex gap-2">
          <Bone className="h-10 w-24 rounded-[--r-md]" />
          <Bone className="h-10 w-24 rounded-[--r-md]" />
        </div>
      </div>

      {/* Kanban — overflow scroll, NO fixed min-width */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3">
          {Array.from({ length: STAGE_COUNT }).map((_, i) => (
            <div
              key={i}
              className="flex w-[min(80vw,320px)] flex-none flex-col rounded-[--r-lg] border border-[--line-1] bg-[--surface-1]"
            >
              <div className="flex items-center justify-between border-b border-[--line-1] px-4 py-3">
                <Bone className="h-3 w-20" />
                <Bone className="h-4 w-6 rounded-full" />
              </div>
              <div className="flex flex-col gap-3 p-3">
                {Array.from({ length: i % 2 === 0 ? 2 : 1 }).map((_, j) => (
                  <div
                    key={j}
                    className="space-y-2 rounded-[--r-md] border border-[--line-1] bg-[--surface-2] p-3"
                  >
                    <Bone className="h-4 w-full" />
                    <Bone className="h-4 w-2/3" />
                    <Bone className="h-3 w-1/2" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
