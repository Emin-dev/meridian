import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--line-1)] bg-[var(--surface-2)] text-[var(--ink-3)]">
        {icon}
      </div>
      <p className="text-sm font-medium text-[var(--ink-1)]">{title}</p>
      {description && (
        <p className="max-w-xs text-xs text-[var(--ink-3)]">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
