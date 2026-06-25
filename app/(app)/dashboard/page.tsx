import { Suspense } from "react";
import DashboardBody from "./dashboard-body";

function Bone({ className }: { className?: string }) {
  return <div className={`rounded-[--r-md] bg-neutral-800 ${className ?? ""}`} />;
}

function DashboardBodySkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* 5 KPI cards */}
      <div className="@container">
        <div className="grid grid-cols-1 gap-4 @sm:grid-cols-2 @lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card p-4 sm:p-5">
              <Bone className="h-3 w-24" />
              <Bone className="mt-3 h-8 w-16" />
            </div>
          ))}
        </div>
      </div>

      {/* TodayAgenda slot */}
      <div className="card p-4">
        <Bone className="mb-3 h-4 w-32" />
        <div className="space-y-2">
          <Bone className="h-10 w-full rounded-[--r-md]" />
          <Bone className="h-10 w-3/4 rounded-[--r-md]" />
        </div>
      </div>

      {/* Pipeline chart + AI digest */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="card h-52 lg:col-span-3" />
        <div className="card h-52 lg:col-span-2" />
      </div>

      {/* Recent activity */}
      <div className="card">
        <div className="border-b border-[--line-1] px-5 py-3">
          <Bone className="h-3 w-28" />
        </div>
        <ul className="divide-y divide-[--line-1]">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="flex gap-4 px-5 py-4">
              <Bone className="mt-0.5 h-5 w-14 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Bone className="h-4 w-3/4" />
                <Bone className="h-3 w-1/2" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Header — renders immediately, before DB query starts */}
      <div>
        <h2 className="text-title3 font-semibold text-[--ink-1]">Dashboard</h2>
        <p className="text-footnote mt-1 text-[--ink-2]">Your sales overview.</p>
      </div>

      {/* Heavy metrics stream in behind a Suspense boundary */}
      <Suspense fallback={<DashboardBodySkeleton />}>
        <DashboardBody />
      </Suspense>
    </div>
  );
}
