"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const inputCls =
  "tap w-full rounded-[--r-md] border border-[--line-1] bg-[--surface-1] px-3 py-2.5 text-body text-[--ink-1] placeholder:text-[--ink-3] [color-scheme:dark] outline-none focus:border-[--accent] transition-colors";

export default function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    login,
    null
  );

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[--bg] px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-[--r-md] bg-[--accent] text-body font-bold text-[--accent-ink]">
            M
          </div>
          <span className="text-callout font-semibold text-[--ink-1]">
            Meridian
          </span>
        </div>

        <h1 className="mb-1 text-title2 font-semibold text-[--ink-1]">
          Sign in
        </h1>
        <p className="mb-6 text-body text-[--ink-2]">
          Enter your credentials to access Meridian.
        </p>

        <form action={action} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-footnote font-medium text-[--ink-2]"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className={inputCls}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-footnote font-medium text-[--ink-2]"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className={inputCls}
              placeholder="••••••••"
            />
          </div>

          {state?.error && (
            <p
              role="alert"
              className="rounded-[--r-md] border border-[--bad]/30 bg-[--bad-tint] px-3 py-2 text-body text-[--bad]"
            >
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="tap press w-full rounded-[--r-md] bg-[--accent] px-4 text-body font-medium text-[--accent-ink] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
