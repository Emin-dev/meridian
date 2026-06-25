function Bone({ className }: { className?: string }) {
  return <div className={`rounded bg-neutral-800 ${className ?? ""}`} />;
}

export default function ContactsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <Bone className="h-7 w-28" />
          <Bone className="mt-2 h-4 w-52" />
        </div>
        <Bone className="h-9 w-28 rounded-lg" />
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900">
        <div className="border-b border-neutral-800 px-5 py-3">
          <Bone className="h-3 w-24" />
        </div>
        <div className="divide-y divide-neutral-800">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-6 px-5 py-3.5">
              <Bone className="h-4 w-28" />
              <Bone className="h-4 w-36" />
              <Bone className="h-4 w-24" />
              <Bone className="h-4 w-28" />
              <Bone className="h-4 w-20" />
              <Bone className="h-5 w-8 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
