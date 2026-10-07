# Security boundaries and verification

## Authentication

- A configured database requires a nonblank signing secret and a valid session.
- A missing secret or `AUTH_ENABLED=false` with a database fails closed.
- Only no-database demos bypass session checks.
- The proxy protects application routes; Server Actions and CSV exports independently check authentication. The database factory also rejects invalid authentication configuration before creating or returning a client.
- The public login and health endpoints are intentional exceptions. The health endpoint checks connectivity, not authentication readiness.
- Sessions are signed cookies. This is a shared workspace, not a multi-tenant or role-isolated system.

Never commit secrets, real customer records, database snapshots, or production test fixtures. Report vulnerabilities privately to the repository maintainer before publishing exploit details; use a verified private contact channel.

## Dependency review: 2026-10-07

The repair updates Next.js from 16.2.9 to 16.4.0, React/React DOM to 19.2.8, and compatible dependency ranges and transitive patches. TypeScript remains on major version 5 and Vitest on major version 4; unrelated major migrations are deliberately excluded.

Primary references:

- [Next.js July security release](https://nextjs.org/blog/july-2026-security-release)
- [Next.js September security release](https://nextjs.org/blog/september-2026-security-release)
- [Next.js 16.4 release](https://nextjs.org/blog/next-16-4)

A clean dependency audit is only a point-in-time advisory check, not a proof that the application is secure.

### Residual development-only advisory

Drizzle Kit 0.31.11 retains `@esbuild-kit/esm-loader` → `@esbuild-kit/core-utils` → esbuild 0.18.20, affected by [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99). The advisory concerns esbuild's development server. This dependency is tooling-only and is not used by the application's production request handling.

No blanket override across esbuild's breaking pre-1.0 releases is applied. Do not expose tooling/development servers to untrusted networks or browse untrusted sites while they are running. CI audits production dependencies at moderate severity and all dependencies at high severity; the remaining moderate finding stays visible. Revisit when Drizzle Kit removes the legacy loader or publishes a compatible fix.

## Operational limits

- Login and AI rate limits are in-memory, per-process controls, not globally coordinated quotas across serverless instances.
- The seed script replaces users and includes demo-password fallbacks. It is unsafe for a shared/production database and is not run by CI or this repair.
- Existing JWT sessions are time-limited but lack a server-side revocation list; account disabling/password rotation does not by itself revoke every existing cookie.
- AI features can transmit CRM content to the configured provider. Review consent, retention, and provider settings before enabling them with customer information.
- Production builds, browser E2E tests, live-database checks, infrastructure controls, deployed secrets, and migrations are outside the automated checks here. Repository instructions reserve builds and deployment for the operator.
