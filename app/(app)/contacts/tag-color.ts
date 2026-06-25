const COLORS = [
  "bg-indigo-500/20 text-indigo-300",
  "bg-violet-500/20 text-violet-300",
  "bg-emerald-500/20 text-emerald-300",
  "bg-amber-500/20 text-amber-300",
  "bg-rose-500/20 text-rose-300",
  "bg-sky-500/20 text-sky-300",
  "bg-orange-500/20 text-orange-300",
  "bg-teal-500/20 text-teal-300",
];

export function tagColor(tag: string): string {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) | 0;
  return COLORS[Math.abs(h) % COLORS.length];
}
