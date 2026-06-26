# CLAUDE.md — Meridian (AI sales & automation CRM)

Read this first. It is the durable contract for working in this repo. Keep changes small, real, and verified.

## Stack
- **Next.js 16** (App Router, React Server Components) · **TypeScript (strict)**
- **Tailwind CSS v4** with semantic design tokens in `app/globals.css` (see `DESIGN.md`)
- **Drizzle ORM** + **Neon Postgres** (`db/schema.ts`, access via `getDb()` in `db/index.ts`)
- **DeepSeek** AI via `lib/ai.ts` (OpenAI-compatible; timeouts + LRU cache + graceful fallback)
- **pnpm** · deployed on **Vercel**

## Commands
- Install: `pnpm install`
- Typecheck (use this to self-verify — fast): `pnpm exec tsc --noEmit`
- Lint: `pnpm lint`  (fix errors you introduce; pre-existing warnings are OK)
- DB migrate (schema changes): `pnpm db:push` (drizzle-kit; **never hand-write SQL migrations** — this project has no migration files)
- Tests: `pnpm test` (vitest) once the runner exists
- **Do NOT run** `pnpm dev`, `pnpm build`, `next build`, or `vercel` — they are slow/forbidden here; the loop typechecks and the operator batches deploys.

## Data models (`db/schema.ts`)
`contacts`, `deals`, `activities`, `tasks`, `sequences`, `contactSequenceEnrollments`, `deal_events`, `appSettings`, `users`. Hot tables are indexed; add an `index(...)` entry (applied via `pnpm db:push`) when you add a hot query path.

## Architecture conventions
- **Server Components by default**; `"use client"` only when interactivity needs it.
- **Mutations = Server Actions** with `zod` validation; `revalidatePath` after writes; return the existing state-union shape (never widen a signature).
- **`getDb()` returns `null`** when `DATABASE_URL` is unset — always handle null with a friendly empty state; the app must be viewable with no DB. Never wall the app behind a login when there is no DB.
- **AI** only via `lib/ai.ts`; cheap model by default; never block render on AI; never call AI during build/SSG.
- **Design**: follow `DESIGN.md` tokens (warm palette, no raw hex/neutral-/indigo- classes). Mobile = bottom tab bar + **action sheets instead of dropdowns**, 44px tap targets, zero horizontal overflow (see `MOBILE.md`).

## Do-not-touch zones (need a passing check / explicit care)
- `lib/auth.ts`, `middleware.ts` — auth. Don't change without preserving the JWT/guard behavior.
- DB migrations — generate via `pnpm db:push`, never hand-edit.
- Secrets — read only from `process.env`; never hardcode, print, or commit a key.
- The build-loop itself lives in `../meridian-loop` — out of scope; never edit it.

## Vercel free-tier limits the app must respect
- Every server action / route handler must finish **< 10s** (hard limit).
- **No Vercel cron > 1/day.** Keep queries paginated and cheap; keep function bundles small.

## Definition of done (every change)
Typecheck clean · real user-flow traced (not just "it compiles") · no placeholders/stubs/TODOs · no regressions or weakened validation · committed. If you can't make it green, revert and leave the tree clean.
