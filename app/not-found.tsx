import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <div className="card w-full max-w-sm px-6 py-10 text-center">
        <p className="text-title3 font-semibold text-[var(--ink-2)]">404</p>
        <h1 className="mt-2 text-title2 font-semibold text-[var(--ink-1)]">
          Page not found
        </h1>
        <p className="mt-2 text-body text-[var(--ink-2)]">
          The page you're looking for doesn't exist or may have been moved.
        </p>
        <Link
          href="/dashboard"
          className="tap mt-6 inline-flex items-center justify-center rounded-[var(--r-md)] bg-[var(--accent)] px-4 text-body font-medium text-[var(--accent-ink)] transition active:scale-[0.98]"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
