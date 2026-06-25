"use client";

import { useEffect, useState } from "react";

type Health = { ok: boolean; db: string; dbTime?: string | null };

export function HealthBadge() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((data: Health) => setHealth(data))
      .catch(() => setError(true));
  }, []);

  const status = error
    ? { color: "bg-red-400", label: "API unreachable" }
    : !health
      ? { color: "bg-neutral-500 animate-pulse", label: "checking…" }
      : health.db === "connected"
        ? { color: "bg-emerald-400", label: "database connected" }
        : health.db === "not_configured"
          ? { color: "bg-amber-400", label: "database not configured yet" }
          : { color: "bg-red-400", label: "database error" };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900/40 px-4 py-3 text-sm">
      <span
        className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${status.color}`}
      />
      <span className="text-neutral-300">
        <code className="text-neutral-400">/api/health</code> — {status.label}
      </span>
    </div>
  );
}
