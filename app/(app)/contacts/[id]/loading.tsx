import type { ReactNode } from "react";

function Bone({ className }: { className?: string }) {
  return <div className={`rounded-[var(--r-md)] bg-[var(--surface-2)] ${className ?? ""}`} />;
}

function SkeletonCard({ children }: { children: ReactNode }) {
  return (
    <div className="card px-4 py-5 sm:px-6">
      {children}
    </div>
  );
}

export default function ContactDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Breadcrumb */}
      <Bone className="h-4 w-20" />

      {/* Title */}
      <div>
        <Bone className="h-7 w-44" />
        <Bone className="mt-2 h-4 w-36" />
      </div>

      {/* Edit card */}
      <SkeletonCard>
        <Bone className="mb-4 h-4 w-28" />
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i}>
              <Bone className="mb-1 h-3 w-16" />
              <Bone className="h-10 w-full rounded-[var(--r-md)]" />
            </div>
          ))}
        </div>
      </SkeletonCard>

      {/* AI panels */}
      {Array.from({ length: 5 }).map((_, i) => (
        <SkeletonCard key={i}>
          <Bone className="mb-3 h-4 w-32" />
          <Bone className="h-16 w-full rounded-[var(--r-md)]" />
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
