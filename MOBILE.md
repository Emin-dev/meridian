# Meridian — Mobile UI (iOS-native) + Two-UI Architecture

Meridian ships **two purpose-built UIs that share the same data, server actions, and features** — NOT one stretched responsive layout. Desktop and mobile each get a UI optimized for its form factor, with **full feature parity**: every job can be done from either.

## The two-UI rule
- **Shared core (identical):** server components, server actions, data, validation, business logic.
- **Presentation diverges by form factor:**
  - **Desktop (lg+):** left sidebar nav, centered modals, dropdown menus, dense tables, hover states.
  - **Mobile (<lg):** iOS-style — bottom tab bar, large-title headers, full-screen / bottom sheets, **action sheets instead of dropdowns**, stacked cards (never horizontal tables), tap-first.
- Implement with distinct components chosen by viewport (`hidden lg:block` / `lg:hidden`, or a layout that renders `<MobileShell>` vs `<DesktopShell>`), both wired to the SAME data + actions. Never cram a desktop control onto mobile.

## iOS rules for the mobile UI
- **Bottom tab bar** for primary nav (e.g. Dashboard, Contacts, Deals, More) with `env(safe-area-inset-bottom)`; a **"More" sheet** for the rest. No sidebar on mobile.
- **Every menu / popover / dropdown / overflow-menu / custom select → a bottom action sheet** on mobile. (The current dropdowns don't fit the viewport or don't respond to taps — replace them.) Rows ≥44px, full-width, slide up, dismiss on backdrop-tap + swipe-down, safe-area padded.
- **Forms → full-screen or large bottom sheets**: sticky header (Cancel · title · Save), scrollable body, sticky footer above the home indicator.
- **Lists → stacked rows/cards** with generous spacing, a chevron affordance, the key fields only, and swipe actions where natural. No horizontal-scrolling tables on mobile.
- Large titles, DESIGN.md type tokens, hairline separators, momentum scroll, **no tap delay**, clear active-press states. Safe-area everywhere; `dvh`/`svh`; **zero horizontal overflow** at any width.

## Instant performance — make it feel 10× faster
- **Optimistic UI** on EVERY mutation (`useOptimistic` / instant local update, reconcile after) so taps feel instant — never wait on the server to reflect a change.
- **Prefetch** routes on intent/visibility; use the **View Transitions API** for native-feel screen changes.
- **Minimize client JS:** RSC by default, client components only where interaction needs them. **Stream** with Suspense + skeletons so content paints immediately.
- Cache hot reads; no layout shift; debounce/throttle; keep the main thread free. Tab/screen switches must be **instant**, never spinner-first.

Every mobile change must keep the desktop UI intact and preserve all functionality.
