/**
 * Labeled value row used in record detail sheets (deals + contacts).
 * Truncates long values and keeps a consistent caption/body type scale.
 */
export default function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-caption uppercase tracking-wider text-[--ink-3]">{label}</dt>
      <dd className="mt-0.5 truncate text-body text-[--ink-1]">{value}</dd>
    </div>
  );
}
