export default function ActivityPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-100">Activity</h2>
        <p className="mt-1 text-sm text-neutral-400">A log of all actions across your CRM.</p>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900">
        <div className="border-b border-neutral-800 px-5 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Recent Events</p>
        </div>
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-neutral-500">No activity recorded yet.</p>
        </div>
      </div>
    </div>
  );
}
