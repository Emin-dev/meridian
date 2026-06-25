# Meridian — Platform Vision (admin-configurable, per-client)

Meridian is evolving from a single CRM into an **admin-controlled, multi-tenant AI platform**. One codebase that is **different per client and per user**, fully configured by the **admin (owner)** — end-users only see what the admin enables for them.

## Principles
- **Admin-controlled.** A protected `/admin` console where the admin configures everything. Regular users never see admin controls.
- **Per-client + per-user customization, config-driven.** Navigation (tab order), enabled/disabled pages, white-label (name, accent, logo), and features differ per client and per user via STORED CONFIG — never hardcode per-client behavior, never require a code change to customize a client.
- **Pluggable AI providers.** Provider + model + API key are configurable per client (DeepSeek, OpenAI, Anthropic, any OpenAI-compatible). `lib/ai.ts` routes through a provider registry; the chat() callers don't change.
- **Usage & cost metering.** Every AI call is logged (client, user, provider, model, input/output tokens, cost). Admin sees spend per user and per client over any time range.
- **Pricing intelligence.** When a provider/model is added, AI auto-researches current pricing and fills a pricing registry (admin confirms/edits). Cost = usage × pricing, computed automatically.
- **Pervasive, anticipatory AI.** Background automations + inline AI everywhere — the app should feel like it knows what you want next. Add small AI affordances broadly (smart defaults, suggested labels, auto next-steps).
- **Always simple.** Every addition stays minimal and easy per `DESIGN.md`. More power, never more clutter.

## Architecture (keep consistent across tickets)
- `clients` (tenants) + nullable `client_id` on tenant-scoped rows; an admin "current client" context.
- `users.role` = `admin | member`; an admin-only guard protects `/admin`.
- Config lives in rows/JSON (per-client + per-user), read at render time. A single resolver merges: defaults → client config → user overrides.
- Secrets (API keys) stored encrypted; never logged, never exposed to non-admins.
- Every change is a small shippable slice that keeps the app building and ALL existing features working (smoke-tested). Auth stays opt-in for viewing, but `/admin` always requires an admin login.
