interface Props {
  score: number;
}

function colorClass(score: number): string {
  if (score >= 70) return "bg-[--ok-tint] text-[--ok] ring-1 ring-[--ok]/30";
  if (score >= 40) return "bg-[--warn-tint] text-[--warn] ring-1 ring-[--warn]/30";
  return "bg-[--bad-tint] text-[--bad] ring-1 ring-[--bad]/30";
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
