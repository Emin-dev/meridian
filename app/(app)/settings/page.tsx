import { HealthBadge } from "@/app/health-badge";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-100">Settings</h2>
        <p className="mt-1 text-sm text-neutral-400">Configure your Meridian workspace.</p>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 space-y-4">
        <p className="text-sm font-medium text-neutral-300">System Health</p>
        <HealthBadge />
        <p className="text-xs text-neutral-500">
          Checks connectivity to the Neon Postgres database via{" "}
          <code className="rounded bg-neutral-800 px-1 py-0.5 text-neutral-400">/api/health</code>.
        </p>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
        <p className="text-sm font-medium text-neutral-300">General</p>
        <p className="mt-3 text-sm text-neutral-500">General settings will appear here.</p>
      </div>
    </div>
  );
}
