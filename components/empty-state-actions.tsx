import type { ReactNode } from "react";
import Link from "next/link";
import { DemoDataButton } from "@/components/demo-data-button";

interface EmptyStateActionsProps {
  /** When set, renders a "Clear filters" link to this href. */
  clearFiltersHref?: string;
  /** The page-specific primary action (e.g. a create modal) shown beside "Load demo data". */
  primaryAction?: ReactNode;
}

/**
 * Shared empty-state action block for list pages. With `clearFiltersHref` it
 * renders the "Clear filters" link; otherwise it renders the page's primary
 * action alongside the "Load demo data" button.
 */
export default function EmptyStateActions({
  clearFiltersHref,
  primaryAction,
}: EmptyStateActionsProps) {
  if (clearFiltersHref) {
    return (
      <Link
        href={clearFiltersHref}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[--line-1] bg-[--surface-2] px-3 py-1.5 text-xs font-medium text-[--ink-2] transition-colors hover:bg-[--surface-3] hover:text-[--ink-1]"
      >
        Clear filters
      </Link>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {primaryAction}
      <DemoDataButton
        label="Load demo data"
        className="inline-flex items-center gap-2 rounded-lg border border-[--line-1] bg-[--surface-2] px-3 py-1.5 text-xs font-medium text-[--ink-2] transition-colors hover:bg-[--surface-3] hover:text-[--ink-1] disabled:opacity-50"
      />
    </div>
  );
}
