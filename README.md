# Meridian

A sales CRM built with Next.js and TypeScript. Meridian brings contact management, deal pipelines, tasks, outreach sequences, and optional AI assistance into a responsive workspace.

## What it does

- Manage contacts, tags, ownership, notes, CSV imports, and bounded CSV exports
- Track deals, pipeline stages, activities, and follow-up tasks
- Enroll contacts in outreach sequences and review upcoming steps
- Explore dashboards, analytics, and search
- Use optional AI-assisted scoring, summaries, enrichment suggestions, and outreach drafts
- Preview the interface without provisioning a database

The application uses a shared-workspace model. Authentication protects database-backed installations; it does not provide tenant isolation or role-based access control.

## Technology

- Next.js 16 App Router with React Server Components and Server Actions
- TypeScript in strict mode, React 19, and Tailwind CSS 4
- Drizzle ORM and Neon Postgres through the serverless HTTP driver
- Signed session cookies with `jose`; password hashing with scrypt
- Optional DeepSeek-compatible chat completions
- Vitest and a frozen pnpm lockfile

## Requirements

Use Node.js 24 LTS and the pinned `pnpm@11.19.0` package manager. Node.js 22 or later is declared in `package.json`.

```sh
npm install --global pnpm@11.19.0
pnpm install --frozen-lockfile
cp .env.example .env.local
```

Keep `.env.local` out of version control. No production credentials are needed for the automated checks.

### Public demo

Leave `DATABASE_URL` empty. Pages render their no-database states; actions cannot persist CRM records. `AUTH_ENABLED=false` is optional and accepted only without a database. AI access remains separately controlled by its API key; leave it empty for a credential-free demo.

### Database-backed installation

Set `DATABASE_URL` to an isolated Neon database and set a unique, randomly generated `AUTH_SECRET` before serving traffic. For example, generate the secret locally using `openssl rand -base64 32`.

| Database | Secret | Behavior |
| --- | --- | --- |
| Absent | Absent | Public no-database demo |
| Absent | Present | Public no-database demo |
| Present | Absent or blank | Refuses access; configuration error |
| Present | Present | Session required |

`AUTH_ENABLED=false` with a connected database is rejected. It cannot override authentication. The proxy returns a non-cacheable 503 for invalid configuration, while server-side guards throw before data access.

For schema work, review `db/schema.ts` and generated migrations in `drizzle/`. `pnpm db:generate` generates migration files; `pnpm db:push` changes the database directly and must only target a database you intend to modify. Nothing in CI runs database schema or seed commands.

**Seed warning:** the existing `pnpm db:seed` script deletes and recreates the users table contents and falls back to public demo passwords if seed-password variables are omitted. `pnpm db:seed:demo` also inserts sample CRM data. Do not run either on a shared or production database. Account provisioning and any credential rotation must be reviewed separately.

### Optional AI

Set `DEEPSEEK_API_KEY` only when you intend to enable provider calls. `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL_FLASH`, and the optional `DEEPSEEK_MODEL_PRO` configure the provider and models. AI features may send relevant CRM content to that provider; review the integration and data-sharing requirements before using real customer information.

## Verification

```sh
pnpm typecheck
pnpm test
pnpm audit --prod --audit-level moderate
pnpm audit --audit-level high
```

`pnpm check` combines type checking and tests. CI runs a frozen install, those checks, and dependency audits with no database or provider credentials. Tests use synthetic fixtures and mocked data access, including the authentication configuration matrix, proxy boundaries, direct Server Action guards, and export authorization.

The repository's [development instructions](CLAUDE.md) reserve dev servers, builds, and deployments for the operator. This repair workflow therefore does not run `pnpm dev` or `pnpm build`. There is currently no configured lint command. Passing CI is not evidence of a production build, live-database migration, browser end-to-end test, or deployment validation.

## Project structure

```text
app/(app)/        CRM pages and server actions
app/login/        Sign-in flow
app/api/          CSV exports and health endpoint
components/       Shared UI and application shell
db/               Schema, database client, and seed utilities
lib/              Authentication, AI, rate limiting, and domain helpers
tests/            Synthetic unit and security regression tests
```

`GET /api/health` is public and reports service/database connectivity. It is not an authentication-readiness check. See [SECURITY.md](SECURITY.md) for the trust boundaries and remaining operational limitations.

## Deployment review

Use an isolated preview database, never production credentials in pull-request CI. Before a production release, an operator must validate a production build, provision non-demo accounts, review environment variables and schema changes, and exercise authenticated read/write/export flows. Hosting configuration and deployment status are not verified by this repository's tests.
