export default function DealsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-neutral-100">Deals</h2>
          <p className="mt-1 text-sm text-neutral-400">Track your pipeline and close more revenue.</p>
        </div>
        <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500">
          Add Deal
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {["Prospecting", "Negotiation", "Closed Won"].map((stage) => (
          <div key={stage} className="rounded-xl border border-neutral-800 bg-neutral-900">
            <div className="border-b border-neutral-800 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{stage}</p>
            </div>
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-neutral-600">No deals</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
