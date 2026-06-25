function Bone({ className }: { className?: string }) {
  return <div className={`rounded bg-neutral-800 ${className ?? ""}`} />;
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-6 py-5">
      {children}
    </div>
  );
}

export default function ContactDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Breadcrumb */}
      <Bone className="h-4 w-20" />

      <div>
        <Bone className="h-7 w-44" />
        <Bone className="mt-2 h-4 w-36" />
      </div>

      {/* Edit card */}
      <Card>
        <Bone className="mb-4 h-4 w-28" />
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i}>
              <Bone className="mb-1 h-3 w-16" />
              <Bone className="h-9 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </Card>

      {/* AI panels */}
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <Bone className="mb-3 h-4 w-32" />
          <Bone className="h-16 w-full rounded-lg" />
        </Card>
      ))}

      {/* Activity timeline */}
      <Card>
        <Bone className="mb-4 h-4 w-36" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Bone className="h-5 w-12 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Bone className="h-4 w-2/3" />
                <Bone className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
