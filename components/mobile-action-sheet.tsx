"use client";

import type { ReactNode } from "react";

import { useOverlayDismiss } from "@/hooks/use-overlay-dismiss";

type MobileActionSheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
};

/**
 * Shared mobile bottom-sheet shell.
 *
 * Extracts the proven phone-stage-picker sheet from the deals kanban board:
 * a dimmed backdrop plus a rounded panel anchored to the bottom of the
 * viewport, with a centered drag handle and safe-area padding. Dismiss /
 * focus-trap / Escape parity comes from {@link useOverlayDismiss}; the
 * backdrop click also closes. Renders nothing while closed.
 */
export default function MobileActionSheet({
  open,
  onClose,
  title,
  children,
}: MobileActionSheetProps) {
  const sheetRef = useOverlayDismiss<HTMLDivElement>(open, onClose);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-[var(--r-2xl)] bg-[var(--surface-2)] shadow-[var(--shadow-3)] pb-[env(safe-area-inset-bottom)]"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="h-1 w-10 rounded-full bg-[var(--line-2)]" />
        </div>

        <div className="px-4 pb-4">
          {title && (
            <p className="mb-2 text-caption uppercase tracking-wider text-[var(--ink-3)]">
              {title}
            </p>
          )}
          {children}
        </div>
      </div>
    </>
  );
}
