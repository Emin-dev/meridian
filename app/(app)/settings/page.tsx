import { DemoDataButton } from "@/components/demo-data-button";
import { getDb, schema } from "@/db";
import { getSession } from "@/lib/auth";
import { getCrmSettings } from "@/lib/settings";
import { PreferencesForm } from "./preferences-form";

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`}
    />
  );
}

export default async function SettingsPage() {
  const db = getDb();
  const [session, crmSettings] = await Promise.all([
    getSession(),
    getCrmSettings(),
  ]);

  let contactCount = 0;
  if (db) {
    const rows = await db
      .select({ id: schema.contacts.id })
      .from(schema.contacts)
      .limit(1);
    contactCount = rows.length;
  }

  const dbConnected = db !== null;
  const aiKeySet = Boolean(process.env.DEEPSEEK_API_KEY);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-100">Settings</h2>
        <p className="mt-1 text-sm text-neutral-400">
          Configure your Meridian workspace.
        </p>
      </div>

      {/* Account */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 space-y-3">
        <p className="text-sm font-medium text-neutral-300">Account</p>
        {session ? (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-700 text-sm font-semibold text-neutral-200 shrink-0">
              {session.email[0].toUpperCase()}
            </div>
            <div>
              <p className="text-sm text-neutral-200">{session.email}</p>
              <p className="text-xs text-neutral-500">Signed in</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">Not signed in.</p>
        )}
      </div>

      {/* Connection health */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 space-y-4">
        <p className="text-sm font-medium text-neutral-300">Connection Health</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-200">Neon Postgres</p>
              <p className="text-xs text-neutral-500">
                {dbConnected ? "DATABASE_URL is set and connected." : "DATABASE_URL is not configured."}
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <StatusDot ok={dbConnected} />
              <span className={dbConnected ? "text-emerald-400" : "text-red-400"}>
                {dbConnected ? "Connected" : "Not connected"}
              </span>
            </div>
          </div>

          <div className="border-t border-neutral-800" />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-200">DeepSeek API</p>
              <p className="text-xs text-neutral-500">
                {aiKeySet ? "DEEPSEEK_API_KEY is set." : "DEEPSEEK_API_KEY is not configured."}
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <StatusDot ok={aiKeySet} />
              <span className={aiKeySet ? "text-emerald-400" : "text-red-400"}>
                {aiKeySet ? "Key present" : "Key missing"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* CRM Preferences */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 space-y-4">
        <div>
          <p className="text-sm font-medium text-neutral-300">CRM Preferences</p>
          <p className="mt-1 text-xs text-neutral-500">
            Set your display name, default currency, and default deal stage.
          </p>
        </div>
        {!db ? (
          <p className="text-xs text-neutral-500">
            Connect a database to save preferences.
          </p>
        ) : (
          <PreferencesForm current={crmSettings} />
        )}
      </div>

      {/* Demo data */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 space-y-4">
        <div>
          <p className="text-sm font-medium text-neutral-300">Demo Data</p>
          <p className="mt-1 text-xs text-neutral-500">
            Load realistic sample data — 8 contacts, 8 deals across pipeline
            stages, and 16 activities — to explore all of Meridian&apos;s features.
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
    </div>
  );
}
