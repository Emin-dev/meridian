# Meridian

A production-ready foundation for a big app — chosen for speed and low overhead on Vercel.

## Stack

| Layer       | Choice                          | Why                                              |
| ----------- | ------------------------------- | ------------------------------------------------ |
| Framework   | Next.js 16 (App Router, RSC)    | Vercel-native, streaming, small client bundles   |
| Language    | TypeScript                      | Safety at scale                                  |
| Styling     | Tailwind CSS v4                 | Zero-runtime, fast                               |
| Database    | Neon Postgres (serverless)      | Scales to zero, edge-ready, Vercel integration   |
| ORM         | Drizzle                         | Lightweight, fast cold starts                    |
| Pkg manager | pnpm                            | Fast installs, small disk                        |
| Hosting     | Vercel (GitHub auto-deploy)     | Push to `main` → production                      |

## Local development

```bash
pnpm install
cp .env.example .env.local   # then fill in DATABASE_URL + AUTH_SECRET
pnpm db:push                 # sync the schema to Neon
pnpm dev                     # http://localhost:3000
```

## Database (Drizzle + Neon)

- Schema lives in [`db/schema.ts`](db/schema.ts).
- Client is created lazily in [`db/index.ts`](db/index.ts) via `getDb()` — returns `null` until `DATABASE_URL` is set, so the app builds and serves before the DB exists.
- Migrations:
  - `pnpm db:push` — push the schema directly to the database (fast iteration).
  - `pnpm db:generate` — generate SQL migration files into `./drizzle`.
  - `pnpm db:studio` — open Drizzle Studio.

## Health check

`GET /api/health` reports service + database status as JSON. The homepage shows a live badge from it.

## Deployment

Connected to Vercel — every push to `main` triggers a production deploy. Environment variables (`DATABASE_URL`, `AUTH_SECRET`) are configured in the Vercel project settings.
