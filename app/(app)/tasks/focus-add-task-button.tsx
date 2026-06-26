"use client";

export default function FocusAddTaskButton() {
  return (
    <button
      type="button"
      onClick={() => {
        const el = document.getElementById(
          "tqf-subject"
        ) as HTMLInputElement | null;
        if (!el) return;
        const reduce = window.matchMedia(
          "(prefers-reduced-motion: reduce)"
        ).matches;
        el.scrollIntoView({
          behavior: reduce ? "auto" : "smooth",
          block: "center",
        });
        el.focus({ preventScroll: true });
      }}
      className="tap press inline-flex items-center justify-center gap-2 rounded-[--r-md] bg-[--accent] px-5 text-body font-medium text-[--accent-ink] transition-opacity hover:opacity-90"
    >
      Add a task
    </button>
  );
}
