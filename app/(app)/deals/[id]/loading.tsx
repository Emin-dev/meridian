import type { ReactNode } from "react";

function Bone({ className }: { className?: string }) {
  return <div className={`rounded-[--r-md] bg-neutral-800 ${className ?? ""}`} />;
}

function SkeletonCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 sm:p-5">
      {children}
    </div>
  );
}

export default function DealDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Back link */}
      <Bone className="h-4 w-16" />

      {/* Header + edit form */}
      <SkeletonCard>
        <Bone className="h-7 w-52" />
        <Bone className="mt-2 h-4 w-32" />
        <div className="mt-4 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <Bone className="mb-1 h-3 w-16" />
              <Bone className="h-10 w-full rounded-[--r-md]" />
            </div>
          ))}
        </div>
      </SkeletonCard>

      {/* Linked contact */}
      <SkeletonCard>
        <Bone className="mb-3 h-4 w-28" />
        <div className="flex items-center gap-3">
          <Bone className="h-9 w-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Bone className="h-4 w-40" />
            <Bone className="h-3 w-28" />
          </div>
        </div>
      </SkeletonCard>

      {/* Notes */}
      <SkeletonCard>
        <Bone className="mb-4 h-4 w-16" />
        <Bone className="h-24 w-full rounded-[--r-md]" />
      </SkeletonCard>

      {/* AI panels */}
      {Array.from({ length: 5 }).map((_, i) => (
        <SkeletonCard key={i}>
          <Bone className="mb-3 h-4 w-32" />
          <Bone className="h-16 w-full rounded-[--r-md]" />
        </SkeletonCard>
      ))}

      {/* Activity timeline */}
      <SkeletonCard>
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
      </SkeletonCard>
    </div>
  );
}
