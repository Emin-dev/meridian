"use client";

import { useState } from "react";

interface ExportCsvButtonProps {
  hasDb: boolean;
  status?: string;
  company?: string;
  minScore?: string;
  source?: string;
  tag?: string;
  unscored?: string;
  noActivity?: string;
}

export default function ExportCsvButton({
  hasDb,
  status,
  company,
  minScore,
  source,
  tag,
  unscored,
  noActivity,
}: ExportCsvButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    if (loading) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (company) params.set("company", company);
      if (minScore) params.set("minScore", minScore);
      if (source) params.set("source", source);
      if (tag) params.set("tag", tag);
      if (unscored) params.set("unscored", unscored);
      if (noActivity) params.set("noActivity", noActivity);

      const res = await fetch(`/api/contacts/export?${params.toString()}`);
      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "contacts.csv";
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
      <span title="Connect a database to export contacts">
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
