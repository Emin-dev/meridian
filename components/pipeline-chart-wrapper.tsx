"use client";

import dynamic from "next/dynamic";

const PipelineChart = dynamic(() => import("./pipeline-chart"), {
  ssr: false,
  loading: () => (
    <div className="rounded-xl border border-[var(--line-1)] bg-[var(--surface-1)] p-5">
      <p className="mb-4 text-sm font-medium text-[var(--ink-2)]">
        Pipeline by Stage
      </p>
      <div className="flex h-[180px] items-center justify-center">
        <span className="text-xs text-[var(--ink-3)]">Loading chart…</span>
      </div>
    </div>
  ),
});

export default PipelineChart;
