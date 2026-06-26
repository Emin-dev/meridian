"use client";

import { useEffect, useState } from "react";
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

// Every stage reads the single accent token; Won/Lost are the only semantic
// exceptions. No decorative per-stage violet ramp — the chart reads intentional.
const STAGE_TOKENS: Record<string, "--accent" | "--ok" | "--ink-3"> = {
  lead: "--accent",
  qualified: "--accent",
  proposal: "--accent",
  negotiation: "--accent",
  won: "--ok",
  lost: "--ink-3",
};

// Literal token values, used as SSR/fallback before getComputedStyle resolves
// them (recharts sets fill as an SVG attribute, which doesn't resolve var()).
const TOKEN_FALLBACK: Record<string, string> = {
  "--accent": "#6d5cf5",
  "--ok": "#2dd4a7",
  "--ink-3": "#646b7a",
  "--ink-2": "#9ba2b1",
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

  const [tokenColors, setTokenColors] = useState(TOKEN_FALLBACK);
  useEffect(() => {
    const styles = getComputedStyle(document.documentElement);
    const resolved: Record<string, string> = {};
    for (const token of Object.keys(TOKEN_FALLBACK)) {
      resolved[token] = styles.getPropertyValue(token).trim() || TOKEN_FALLBACK[token];
    }
    setTokenColors(resolved);
  }, []);

  const chartData = data.map((d) => ({
    name: STAGE_LABELS[d.stage] ?? d.stage,
    stage: d.stage,
    count: d.count,
  }));

  return (
    <div className="h-full rounded-xl border border-[var(--line-1)] bg-[var(--surface-1)] p-5">
      <p className="mb-4 text-sm font-medium text-[var(--ink-1)]">
        Pipeline by Stage
      </p>
      {!hasDeals ? (
        <p className="py-8 text-center text-sm text-[var(--ink-2)]">
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
              tick={{ fill: tokenColors["--ink-2"], fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: tokenColors["--ink-2"], fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              domain={[0, "dataMax"]}
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
            <Bar dataKey="count" radius={[4, 4, 0, 0]} minPointSize={2}>
              {chartData.map((entry) => (
                <Cell
                  key={entry.stage}
                  fill={tokenColors[STAGE_TOKENS[entry.stage] ?? "--accent"]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
