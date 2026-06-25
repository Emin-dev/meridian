import { HealthBadge } from "./health-badge";

const STACK: [string, string][] = [
  ["Framework", "Next.js 16 · App Router"],
  ["Language", "TypeScript"],
  ["Styling", "Tailwind CSS v4"],
  ["Database", "Neon Postgres"],
  ["ORM", "Drizzle"],
  ["Hosting", "Vercel"],
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <header className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight">Meridian</h1>
        <p className="text-base text-neutral-400">
          Production-ready foundation — fast, light, and deployed on Vercel.
          Ready to build the big project on.
        </p>
      </header>

      <HealthBadge />

      <ul className="grid grid-cols-2 gap-3 text-sm">
        {STACK.map(([k, v]) => (
          <li
            key={k}
            className="rounded-lg border border-neutral-800 px-4 py-3"
          >
            <div className="text-xs uppercase tracking-wide text-neutral-500">
              {k}
            </div>
            <div className="text-neutral-200">{v}</div>
          </li>
        ))}
      </ul>

      <p className="text-xs text-neutral-600">
        Edit <code className="text-neutral-400">app/page.tsx</code> to start
        building.
      </p>
    </main>
  );
}
