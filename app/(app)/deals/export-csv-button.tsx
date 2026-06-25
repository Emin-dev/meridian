"use client";

import { useState } from "react";

export default function DealsExportCsvButton({
  hasDb,
  owner,
  stage,
}: {
  hasDb: boolean;
  owner?: string;
  stage?: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    if (loading) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (owner) params.set("owner", owner);
      if (stage) params.set("stage", stage);
      const qs = params.toString();
      const res = await fetch(`/api/deals/export${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "deals.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }

  if (!hasDb) {
    return (
      <span title="Connect a database to export deals">
        <button
          disabled
          className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm font-medium text-neutral-500 cursor-not-allowed opacity-60"
        >
          Export CSV
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm font-medium text-neutral-300 transition-colors hover:bg-neutral-700 hover:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? "Exporting…" : "Export CSV"}
    </button>
  );
}
