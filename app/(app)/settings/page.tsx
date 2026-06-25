import { HealthBadge } from "@/app/health-badge";
import { DemoDataButton } from "@/components/demo-data-button";
import { getDb, schema } from "@/db";

export default async function SettingsPage() {
  const db = getDb();

  let contactCount = 0;
  if (db) {
    const rows = await db
      .select({ id: schema.contacts.id })
      .from(schema.contacts)
      .limit(1);
    contactCount = rows.length;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-100">Settings</h2>
        <p className="mt-1 text-sm text-neutral-400">
          Configure your Meridian workspace.
        </p>
      </div>

      {/* Demo data */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 space-y-4">
        <div>
          <p className="text-sm font-medium text-neutral-300">Demo Data</p>
          <p className="mt-1 text-xs text-neutral-500">
            Load realistic sample data — 8 contacts, 8 deals across pipeline
            stages, and 16 activities — to explore all of Meridian's features.
          </p>
        </div>
        {!db ? (
          <p className="text-xs text-neutral-500">
            Connect a database to use this feature.
          </p>
        ) : contactCount > 0 ? (
          <p className="text-xs text-neutral-500">
            Your workspace already has data. Remove existing contacts to load
            the demo dataset.
          </p>
        ) : (
          <DemoDataButton label="Load demo data" />
        )}
      </div>

      {/* System health */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 space-y-4">
        <p className="text-sm font-medium text-neutral-300">System Health</p>
        <HealthBadge />
        <p className="text-xs text-neutral-500">
          Checks connectivity to the Neon Postgres database via{" "}
          <code className="rounded bg-neutral-800 px-1 py-0.5 text-neutral-400">
            /api/health
          </code>
          .
        </p>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
        <p className="text-sm font-medium text-neutral-300">General</p>
        <p className="mt-3 text-sm text-neutral-500">
          General settings will appear here.
        </p>
      </div>
    </div>
  );
}
