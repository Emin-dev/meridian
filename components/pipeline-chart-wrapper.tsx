"use client";

import dynamic from "next/dynamic";

const PipelineChart = dynamic(() => import("./pipeline-chart"), {
  ssr: false,
  loading: () => (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
      <p className="mb-4 text-sm font-medium text-neutral-300">
        Pipeline by Stage
      </p>
      <div className="flex h-[180px] items-center justify-center">
        <span className="text-xs text-neutral-600">Loading chart…</span>
      </div>
    </div>
  ),
});

export default PipelineChart;
