interface Props {
  score: number;
}

function colorClass(score: number): string {
  if (score >= 70) return "bg-[var(--ok-tint)] text-[var(--ok)] ring-1 ring-[var(--ok)]/30";
  if (score >= 40) return "bg-[var(--warn-tint)] text-[var(--warn)] ring-1 ring-[var(--warn)]/30";
  return "bg-[var(--bad-tint)] text-[var(--bad)] ring-1 ring-[var(--bad)]/30";
}

export default function LeadScoreBadge({ score }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${colorClass(score)}`}
      title={`Lead score: ${score}/100`}
    >
      {score}
    </span>
  );
}
