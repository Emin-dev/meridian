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
    ? { color: "bg-[--bad]", label: "API unreachable" }
    : !health
      ? { color: "bg-[--ink-3] animate-pulse", label: "checking…" }
      : health.db === "connected"
        ? { color: "bg-[--ok]", label: "database connected" }
        : health.db === "not_configured"
          ? { color: "bg-[--warn]", label: "database not configured yet" }
          : { color: "bg-[--bad]", label: "database error" };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-[--line-1] bg-[--surface-1] px-4 py-3 text-sm">
      <span
        className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${status.color}`}
      />
      <span className="text-[--ink-2]">
        <code className="text-[--ink-3]">/api/health</code> — {status.label}
      </span>
    </div>
  );
}
