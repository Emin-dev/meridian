"use client";

import Link from "next/link";
import { DemoDataButton } from "./demo-data-button";

const STEPS = [
  {
    n: "1",
    title: "Add your first contact",
    desc: "Import prospects or add them one by one.",
    href: "/contacts",
    cta: "Go to Contacts →",
  },
  {
    n: "2",
    title: "Create a deal",
    desc: "Track opportunities through your pipeline.",
    href: "/deals",
    cta: "Go to Deals →",
  },
  {
    n: "3",
    title: "Log an activity",
    desc: "Record calls, emails, and meetings.",
    href: "/activity",
    cta: "Go to Activity →",
  },
];

export function OnboardingBanner() {
  return (
    <div className="rounded-xl border border-[var(--line-1)] bg-[var(--accent-tint)] p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-lg font-bold text-[var(--accent-ink)]">
          M
        </div>
        <div>
          <h3 className="text-base font-semibold text-[var(--ink-1)]">
            Welcome to Meridian
          </h3>
          <p className="mt-0.5 text-sm text-[var(--ink-2)]">
            Your AI-first sales CRM. Follow the steps below to get started, or
            load realistic demo data to explore the app right away.
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {STEPS.map((step) => (
          <div
            key={step.n}
            className="card p-4 space-y-2"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent-tint)] text-xs font-semibold text-[var(--accent)]">
                {step.n}
              </span>
              <p className="text-sm font-medium text-[var(--ink-1)]">
                {step.title}
              </p>
            </div>
            <p className="text-xs text-[var(--ink-3)]">{step.desc}</p>
            <Link
              href={step.href}
              className="text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
            >
              {step.cta}
            </Link>
          </div>
        ))}
      </div>

      {/* Demo data CTA */}
      <div className="card flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--ink-1)]">
            Just want to explore?
          </p>
          <p className="text-xs text-[var(--ink-3)]">
            Load 8 contacts, 8 deals, and 16 activities so you can see the full
            app in action.
          </p>
        </div>
        <div className="shrink-0">
          <DemoDataButton label="Load demo data" />
        </div>
      </div>
    </div>
  );
}
