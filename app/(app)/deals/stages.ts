// Single source of truth for deal-stage metadata: the ordered stage keys, their
// labels, the colour dot/text classes, and the stage→probability map. Imported by
// deals/actions.ts and the deals UI (page, kanban, table, stage-control) so the
// pipeline definition lives in exactly one place.

export const DEAL_STAGES = [
  "lead",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
] as const;

export type StageKey = (typeof DEAL_STAGES)[number];

export type StageMeta = {
  key: StageKey;
  label: string;
  /** Tailwind background class for the stage colour dot. */
  dot: string;
  /** Tailwind text-colour class for the stage label in lists/tables. */
  textColor: string;
  /** Win probability assigned when a deal enters this stage. */
  probability: number;
};

export const STAGES: readonly StageMeta[] = [
  { key: "lead", label: "Lead", dot: "bg-blue-500", textColor: "text-[--ink-2]", probability: 10 },
  { key: "qualified", label: "Qualified", dot: "bg-violet-500", textColor: "text-[--ink-2]", probability: 20 },
  { key: "proposal", label: "Proposal", dot: "bg-yellow-500", textColor: "text-[--accent]", probability: 50 },
  { key: "negotiation", label: "Negotiation", dot: "bg-orange-500", textColor: "text-[--accent]", probability: 75 },
  { key: "won", label: "Won", dot: "bg-green-500", textColor: "text-[--ok]", probability: 100 },
  { key: "lost", label: "Lost", dot: "bg-red-500", textColor: "text-[--bad]", probability: 0 },
];

/** Stage → win probability. Indexable by a raw string (DB values) for lookups. */
export const STAGE_PROBABILITY: Record<string, number> = Object.fromEntries(
  STAGES.map((s) => [s.key, s.probability]),
);

/** Stage → display label. Indexable by a raw string for unknown DB values. */
export const STAGE_LABELS: Record<string, string> = Object.fromEntries(
  STAGES.map((s) => [s.key, s.label]),
);

/** Stage → label text-colour class. Indexable by a raw string for unknown DB values. */
export const STAGE_COLORS: Record<string, string> = Object.fromEntries(
  STAGES.map((s) => [s.key, s.textColor]),
);
