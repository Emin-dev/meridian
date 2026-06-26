import type { ReactNode } from "react";

function Bone({ className }: { className?: string }) {
  return <div className={`rounded-[var(--r-md)] bg-[var(--surface-2)] ${className ?? ""}`} />;
}

function SkeletonCard({ children }: { children: ReactNode }) {
  return (
    <div className="card p-4 sm:p-5">
      {children}
    </div>
  );
}

export default function SequenceDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Back link */}
      <Bone className="h-4 w-24" />

      {/* Header: title + status badge + step count */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Bone className="h-7 w-48 max-w-full" />
          <div className="mt-2 flex items-center gap-2">
            <Bone className="h-5 w-16 rounded-[var(--r-pill)]" />
            <Bone className="h-5 w-12 rounded-[var(--r-md)]" />
            <Bone className="h-4 w-14" />
          </div>
        </div>
        <Bone className="h-4 w-28" />
      </div>

      {/* Tabs row */}
      <div className="flex gap-4 border-b border-[var(--line-1)] pb-2">
        <Bone className="h-5 w-12" />
        <Bone className="h-5 w-32" />
        <Bone className="h-5 w-16" />
      </div>

      {/* Step cards */}
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <Bone className="h-4 w-40 max-w-full" />
                <Bone className="h-3 w-2/3 max-w-full" />
              </div>
              <Bone className="h-8 w-16 shrink-0 rounded-[var(--r-md)]" />
            </div>
          </SkeletonCard>
        ))}
      </div>

      {/* Add-step form */}
      <SkeletonCard>
        <Bone className="mb-4 h-4 w-28" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <Bone className="mb-1 h-3 w-20" />
              <Bone className="h-10 w-full rounded-[var(--r-md)]" />
            </div>
          ))}
        </div>
      </SkeletonCard>
    </div>
  );
}
