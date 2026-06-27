import { count } from "drizzle-orm";
import { DemoDataButton } from "@/components/demo-data-button";
import { getDb, schema } from "@/db";
import { getSession } from "@/lib/auth";
import { getCrmSettings } from "@/lib/settings";
import { PreferencesForm } from "./preferences-form";

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${ok ? "bg-[var(--ok)]" : "bg-[var(--bad)]"}`}
    />
  );
}

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const db = getDb();
  const [session, crmSettings] = await Promise.all([
    getSession(),
    getCrmSettings(),
  ]);

  let contactCount = 0;
  if (db) {
    const rows = await db
      .select({ value: count() })
      .from(schema.contacts);
    contactCount = rows[0]?.value ?? 0;
  }

  const dbConnected = db !== null;
  const aiKeySet = Boolean(process.env.DEEPSEEK_API_KEY);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-title2 font-semibold text-[var(--ink-1)]">Settings</h2>
        <p className="mt-1 text-body text-[var(--ink-2)]">
          Configure your Meridian workspace.
        </p>
      </div>

      {/* Account */}
      <div className="card p-4 sm:p-5 space-y-3">
        <p className="text-callout font-semibold text-[var(--ink-1)]">Account</p>
        {session ? (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface-3)] text-body font-semibold text-[var(--ink-1)]">
              {session.email[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-body text-[var(--ink-1)] truncate">{session.email}</p>
              <p className="text-footnote text-[var(--ink-3)]">Signed in</p>
            </div>
          </div>
        ) : (
          <div className="min-w-0">
            <p className="text-body text-[var(--ink-1)]">Demo mode — authentication disabled</p>
            <p className="mt-1 text-footnote text-[var(--ink-3)]">
              Set <code className="font-mono">AUTH_SECRET</code> and <code className="font-mono">AUTH_ENABLED=true</code> to require sign-in.
            </p>
          </div>
        )}
      </div>

      {/* Connection health */}
      <div className="card p-4 sm:p-5 space-y-0">
        <p className="text-callout font-semibold text-[var(--ink-1)] mb-4">Connection Health</p>
        <div className="divide-y divide-[var(--line-1)]">
          <div className="flex items-center justify-between gap-4 pb-3">
            <div className="min-w-0">
              <p className="text-body text-[var(--ink-1)]">Neon Postgres</p>
              <p className="text-footnote text-[var(--ink-3)]">
                {dbConnected
                  ? "DATABASE_URL is set and connected."
                  : "DATABASE_URL is not configured."}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-footnote">
              <StatusDot ok={dbConnected} />
              <span className={dbConnected ? "text-[var(--ok)]" : "text-[var(--bad)]"}>
                {dbConnected ? "Connected" : "Not connected"}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 pt-3">
            <div className="min-w-0">
              <p className="text-body text-[var(--ink-1)]">DeepSeek API</p>
              <p className="text-footnote text-[var(--ink-3)]">
                {aiKeySet
                  ? "DEEPSEEK_API_KEY is set."
                  : "DEEPSEEK_API_KEY is not configured."}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-footnote">
              <StatusDot ok={aiKeySet} />
              <span className={aiKeySet ? "text-[var(--ok)]" : "text-[var(--bad)]"}>
                {aiKeySet ? "Key present" : "Key missing"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* CRM Preferences */}
      <div className="card p-4 sm:p-5 space-y-4">
        <div>
          <p className="text-callout font-semibold text-[var(--ink-1)]">CRM Preferences</p>
          <p className="mt-1 text-footnote text-[var(--ink-3)]">
            Set your display name, default currency, and default deal stage.
          </p>
        </div>
        {!db ? (
          <p className="text-footnote text-[var(--ink-3)]">
            Connect a database to save preferences.
          </p>
        ) : (
          <PreferencesForm current={crmSettings} />
        )}
      </div>

      {/* Demo data */}
      <div className="card p-4 sm:p-5 space-y-4">
        <div>
          <p className="text-callout font-semibold text-[var(--ink-1)]">Demo Data</p>
          <p className="mt-1 text-footnote text-[var(--ink-3)]">
            Load realistic sample data — 8 contacts, 8 deals across pipeline
            stages, and 16 activities — to explore all of Meridian&apos;s features.
          </p>
        </div>
        {!db ? (
          <p className="text-footnote text-[var(--ink-3)]">
            Connect a database to use this feature.
          </p>
        ) : contactCount > 0 ? (
          <p className="text-footnote text-[var(--ink-3)]">
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
