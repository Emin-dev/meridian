export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-100">Dashboard</h2>
        <p className="mt-1 text-sm text-neutral-400">Your sales overview will appear here.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {["Total Contacts", "Open Deals", "Revenue (MTD)", "Activities"].map((label) => (
          <div key={label} className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-neutral-100">—</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
        <p className="text-sm font-medium text-neutral-300">Recent Activity</p>
        <p className="mt-3 text-sm text-neutral-500">No activity yet. Start by adding contacts and deals.</p>
      </div>
    </div>
  );
}
