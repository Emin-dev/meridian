"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { CheckIcon, AlertCircleIcon } from "@/components/icons";

type ToastVariant = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

const DURATION_MS = 3500;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const toast = useCallback(
    (message: string, variant: ToastVariant = "success") => {
      const id = ++counter.current;
      setToasts((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, DURATION_MS);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        aria-label="Notifications"
        className="pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom)+76px)] right-4 lg:bottom-5 z-[200] flex flex-col gap-2"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={[
              "pointer-events-auto flex min-w-[220px] max-w-xs items-center gap-2.5 rounded-[--r-lg] px-4 py-3 text-body bg-[--surface-2] border border-[--line-1] shadow-[--shadow-2]",
              t.variant === "error"
                ? "text-[--bad]"
                : t.variant === "info"
                  ? "text-[--info]"
                  : "text-[--ok]",
            ].join(" ")}
          >
            {t.variant === "success" && (
              <CheckIcon size={14} strokeWidth={2.5} className="shrink-0" aria-hidden="true" />
            )}
            {t.variant === "error" && (
              <AlertCircleIcon size={14} strokeWidth={2.5} className="shrink-0" aria-hidden="true" />
            )}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
