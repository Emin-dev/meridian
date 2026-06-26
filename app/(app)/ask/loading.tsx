function Bone({ className }: { className?: string }) {
  return <div className={`rounded-[var(--r-md)] bg-[var(--surface-2)] ${className ?? ""}`} />;
}

export default function AskLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-pulse">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Bone className="h-5 w-5 rounded-[var(--r-md)]" />
          <Bone className="h-6 w-40" />
        </div>
        <Bone className="mt-2 h-4 w-full max-w-md" />
      </div>

      {/* Ask form: textarea + button */}
      <div className="card p-4 sm:p-5 space-y-4">
        <Bone className="h-28 w-full rounded-[var(--r-md)]" />
        <div className="flex justify-end">
          <Bone className="h-10 w-28 rounded-[var(--r-md)]" />
        </div>
      </div>

      {/* Suggested questions */}
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Bone key={i} className="h-8 w-40 rounded-[var(--r-pill)]" />
        ))}
      </div>
    </div>
  );
}
