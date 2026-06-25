interface Props {
  score: number;
}

function colorClass(score: number): string {
  if (score >= 70) return "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30";
  if (score >= 40) return "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30";
  return "bg-red-500/20 text-red-400 ring-1 ring-red-500/30";
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
