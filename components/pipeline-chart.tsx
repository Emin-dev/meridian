"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

type StageData = { stage: string; count: number; value: number };

const STAGE_COLORS: Record<string, string> = {
  lead: "#2b2a55",
  qualified: "#4a3fb0",
  proposal: "#6d5cf5",
  negotiation: "#8273ff",
  won: "#a99cff",
  lost: "#4b4f5e",
};

const STAGE_LABELS: Record<string, string> = {
  lead: "Lead",
  qualified: "Qualified",
  proposal: "Proposal",
  negotiation: "Negot.",
  won: "Won",
  lost: "Lost",
};

export default function PipelineChart({ data }: { data: StageData[] }) {
  const hasDeals = data.some((d) => d.count > 0);

  const chartData = data.map((d) => ({
    name: STAGE_LABELS[d.stage] ?? d.stage,
    stage: d.stage,
    count: d.count,
  }));

  return (
    <div className="rounded-xl border border-[--line-1] bg-[--surface-1] p-5">
      <p className="mb-4 text-sm font-medium text-[--ink-2]">
        Pipeline by Stage
      </p>
      {!hasDeals ? (
        <p className="py-8 text-center text-sm text-[--ink-2]">
          No deals in the pipeline yet.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart
            data={chartData}
            margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
          >
            <XAxis
              dataKey="name"
              tick={{ fill: "#737373", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#737373", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#171717",
                border: "1px solid #404040",
                borderRadius: "8px",
                color: "#f5f5f5",
                fontSize: 12,
              }}
              formatter={(value) => [value, "Deals"]}
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {chartData.map((entry) => (
                <Cell
                  key={entry.stage}
                  fill={STAGE_COLORS[entry.stage] ?? "#6d5cf5"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
