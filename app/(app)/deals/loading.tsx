function Bone({ className }: { className?: string }) {
  return <div className={`rounded bg-neutral-800 ${className ?? ""}`} />;
}

const COLS = 6;

export default function DealsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <Bone className="h-7 w-20" />
          <Bone className="mt-2 h-4 w-56" />
        </div>
        <Bone className="h-9 w-24 rounded-lg" />
      </div>

      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4" style={{ minWidth: `${COLS * 260}px` }}>
          {Array.from({ length: COLS }).map((_, i) => (
            <div
              key={i}
              className="flex w-60 flex-none flex-col rounded-xl border border-neutral-800 bg-neutral-900"
            >
              <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
                <Bone className="h-3 w-20" />
                <Bone className="h-4 w-6 rounded-full" />
              </div>
              <div className="flex flex-col gap-3 p-3">
                {Array.from({ length: i % 2 === 0 ? 2 : 1 }).map((_, j) => (
                  <div
                    key={j}
                    className="rounded-lg border border-neutral-800 bg-neutral-800/50 p-3 space-y-2"
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
