# Meridian — Design System & Build-Loop Bible

This file is the single source of truth for every visual and structural change shipped to Meridian CRM. It is read at the start of every loop iteration. If a change conflicts with this document, this document wins. Meridian is **dark-only, mobile-first, Apple-grade minimal**, built on **Next.js 16 (App Router, React 19) + Tailwind v4 + plain CSS only**. No UI kit, no animation library, no CSS-in-JS. recharts is already present and is the only charting dependency.

---

## 0. The Prime Directives (non-negotiable)

1. **Mobile-first, fits ANY screen.** Design for a 360px phone first, enhance upward. The layout must be flawless from 320px to 4K with no breakpoint left broken.
2. **NEVER any horizontal overflow.** No element may push the page wider than the viewport at any width. No fixed pixel min-widths on layout containers, no un-wrapped `flex justify-between` toolbars, no tables that widen the page. `html, body { overflow-x: hidden }` is a backstop, not a license to ship overflow.
3. **Apple-grade minimalism.** Restraint over decoration. Generous negative space, one accent moment per screen, hairline borders instead of heavy boxes, neutral surfaces differentiated by elevation not hue. Remove before you add.
4. **44×44px minimum touch targets.** Every interactive element. No exceptions for icon buttons, checkboxes, close buttons, or chips.
5. **Lightweight tech only.** Tailwind v4 utilities + the tokens in this file + plain CSS. No new runtime dependencies without explicit instruction.
6. **Preserve all functionality.** Every change improves *form* while keeping *function* identical. The app must build (`next build`) and every existing feature must keep working after every single ticket. Never delete a feature to make it prettier.
7. **One small shippable slice per iteration.** Each push deploys to Vercel. If it can't ship green, it's too big — cut it down.

---

## 1. Foundation: `app/globals.css` token layer

The current `globals.css` is a bare stub. The first foundation ticket replaces it with the token layer below, preserving `@import "tailwindcss"` and the `@theme inline` bridge so existing `bg-neutral-*` / `text-neutral-*` utilities keep compiling. New code uses semantic tokens; legacy utilities are migrated screen-by-screen.

```css
@import "tailwindcss";

:root {
  /* ---- Surfaces (elevation, not hue) ---- */
  --bg:        #0a0a0a;   /* app background */
  --surface-1: #121212;   /* cards, list rows */
  --surface-2: #1a1a1a;   /* raised: popovers, sheet, active row */
  --surface-3: #232323;   /* highest: menus on sheets */

  /* ---- Ink (text) ---- */
  --ink-1: #ededed;  /* primary text */
  --ink-2: #a3a3a3;  /* secondary text, labels */
  --ink-3: #6b6b6b;  /* tertiary, meta, disabled */

  /* ---- Hairlines ---- */
  --line-1: rgba(255,255,255,0.08);  /* default border */
  --line-2: rgba(255,255,255,0.14);  /* hover/active border */

  /* ---- Accent (single iOS blue; one moment per screen) ---- */
  --accent:        #0a84ff;
  --accent-hover:  #3a9bff;
  --accent-ink:    #ffffff;
  --accent-tint:   rgba(10,132,255,0.14);

  /* ---- Status (tint / dot / text only, never large fills) ---- */
  --ok:    #30d158;  --ok-tint:   rgba(48,209,88,0.14);
  --warn:  #ff9f0a;  --warn-tint: rgba(255,159,10,0.14);
  --bad:   #ff453a;  --bad-tint:  rgba(255,69,58,0.14);
  --info:  #64d2ff;  --info-tint: rgba(100,210,255,0.14);

  /* ---- Radii ---- */
  --r-sm: 6px; --r-md: 10px; --r-lg: 14px; --r-xl: 20px; --r-2xl: 28px;
  --r-pill: 999px;

  /* ---- Elevation (reserved for floating layers only) ---- */
  --shadow-1: 0 1px 2px rgba(0,0,0,0.4);
  --shadow-2: 0 8px 24px rgba(0,0,0,0.5);
  --shadow-3: 0 24px 60px rgba(0,0,0,0.6);

  /* ---- Spacing (8pt rhythm; maps onto Tailwind 4px steps) ---- */
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
  --space-5: 24px; --space-6: 32px; --space-7: 48px; --space-8: 64px;

  /* ---- Fluid type scale (clamp, 360→1024px viewport) ---- */
  --text-caption:   clamp(0.6875rem, 0.66rem + 0.12vw, 0.75rem);   /* 11→12 */
  --text-footnote:  clamp(0.75rem,  0.72rem + 0.15vw, 0.8125rem);  /* 12→13 */
  --text-body:      clamp(0.875rem, 0.85rem + 0.2vw,  0.9375rem);  /* 14→15 */
  --text-callout:   clamp(0.9375rem,0.9rem + 0.3vw,   1.0625rem);  /* 15→17 */
  --text-title3:    clamp(1.0625rem,1rem + 0.5vw,     1.25rem);    /* 17→20 */
  --text-title2:    clamp(1.25rem,  1.1rem + 0.8vw,   1.5rem);     /* 20→24 */
  --text-title1:    clamp(1.5rem,   1.3rem + 1.2vw,   1.875rem);   /* 24→30 */
  --text-largetitle:clamp(1.875rem, 1.5rem + 2vw,     2.75rem);    /* 30→44 */

  /* ---- Motion ---- */
  --ease: cubic-bezier(0.32, 0.72, 0, 1);
  --dur-1: 120ms; --dur-2: 200ms; --dur-3: 320ms;
}

@theme inline {
  --color-background: var(--bg);
  --color-foreground: var(--ink-1);
  /* keep legacy aliases compiling during migration */
}

html, body { overflow-x: hidden; }   /* overflow backstop */

body {
  background: var(--bg);
  color: var(--ink-1);
  font-family: ui-sans-serif, system-ui, -apple-system, "SF Pro Text",
    "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

/* Type utilities — never set raw font-size in components */
.text-caption{font-size:var(--text-caption);line-height:1.35}
.text-footnote{font-size:var(--text-footnote);line-height:1.4}
.text-body{font-size:var(--text-body);line-height:1.5}
.text-callout{font-size:var(--text-callout);line-height:1.45}
.text-title3{font-size:var(--text-title3);line-height:1.3;letter-spacing:-0.01em}
.text-title2{font-size:var(--text-title2);line-height:1.25;letter-spacing:-0.015em}
.text-title1{font-size:var(--text-title1);line-height:1.2;letter-spacing:-0.02em}
.text-largetitle{font-size:var(--text-largetitle);line-height:1.1;letter-spacing:-0.025em}

/* Glass (sticky chrome only) */
.glass{
  background: color-mix(in srgb, var(--surface-1) 72%, transparent);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))){
  .glass{ background: var(--surface-1); }
}

/* Reusable primitives */
.tap{ min-height:44px; min-width:44px; }       /* touch target */
.card{ background:var(--surface-1); border:1px solid var(--line-1); border-radius:var(--r-lg); }
.hairline{ border-color:var(--line-1); }

@media (prefers-reduced-motion: reduce){
  *,*::before,*::after{ animation-duration:.01ms!important; transition-duration:.01ms!important; }
}
```

---

## 2. Layout & viewport rules

- **Viewport export is mandatory.** `app/layout.tsx` must export:
  ```ts
  export const viewport: Viewport = {
    width: "device-width", initialScale: 1, viewportFit: "cover",
    themeColor: "#0a0a0a",
  };
  ```
- **Dynamic viewport units.** Full-height shells use `h-dvh` / `min-h-dvh`, never `h-screen`/`vh`. Use `svh` for elements that must not jump when mobile browser chrome appears.
- **Safe-area insets.** Fixed chrome (top bar, bottom tab bar, toaster, FAB, sheets) pads with `env(safe-area-inset-*)`:
  - top bar: `pt-[env(safe-area-inset-top)]`
  - bottom nav / toaster / FAB: `pb-[env(safe-area-inset-bottom)]`
  - scroll containers end with `pb-[calc(var(--space-6)+env(safe-area-inset-bottom))]`.
- **Container queries for components, viewport breakpoints for page chrome.** A component (card, kanban board, table) adapts to *its own* width with `@container`; only the shell (sidebar vs bottom-nav) keys off the viewport. Tailwind v4: `@container` + `@sm:`/`@md:` variants.
- **The page gutter is owned by `<main>`** (`p-4 sm:p-6` → tokenized). Inner cards use `p-4 sm:p-5`; never stack `px-6` inside `px-6` inside the gutter. Target ≤ one nesting of horizontal padding on mobile.
- **No fixed pixel min-widths on layout tracks.** Kanban, tables, toolbars must size from content/container, never `style={{minWidth: Npx}}`.

---

## 3. Navigation pattern

- **Desktop (≥ lg / container ≥ 1024px):** existing fixed left sidebar (`w-60`), refined to tokens. Keep the 8 nav items.
- **Mobile (< lg):** a **bottom tab bar** (`fixed bottom-0 inset-x-0 glass`, `pb-[env(safe-area-inset-bottom)]`, `z-40`) with the 4–5 primary destinations (Dashboard, Contacts, Deals, Activity, +More). The slide-in drawer remains for the full 8-item list behind the hamburger / "More". Each tab is a `.tap` target with icon + `text-caption` label, active state = `--accent` ink + subtle `--accent-tint` pill.
- **Top bar** becomes sticky glass with `pt-[env(safe-area-inset-top)]`; title uses `truncate min-w-0`; search button is a `.tap` target.
- Content scroll area must reserve space so the bottom tab bar never covers the last row (`pb` includes the tab-bar height + safe-area).

---

## 4. Component patterns (copy-paste intent)

**Card** — `class="card p-4 sm:p-5"`; title `text-callout font-semibold`, meta `text-footnote text-[--ink-2]`. No nested shadows; elevation via surface step.

**Grouped list row** — replaces dense tables on mobile. `min-h-44` row, leading avatar/dot, two-line text (primary `text-body`, secondary `text-footnote text-[--ink-2]`), trailing chevron/meta, `divide-y divide-[--line-1]`.

**Toolbar / page header** — `flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`. Action clusters: `flex flex-wrap items-center gap-2`. On mobile, secondary actions collapse into a "•••" overflow menu or move into a sticky sub-bar; never a 6-button non-wrapping row. No orphaned `h-4 w-px` dividers once wrapped — use `gap` and grouping instead.

**Buttons** — primary `.tap bg-[--accent] text-[--accent-ink] rounded-[--r-md] px-4 text-body font-medium`; secondary `.tap border border-[--line-1] bg-[--surface-1]`; ghost `.tap text-[--ink-2]`. Active scale `active:scale-[0.98] transition` (`--dur-1`).

**Inputs** — `.tap`, `w-full sm:w-auto`, `bg-[--surface-1] border border-[--line-1] rounded-[--r-md] px-3 text-body`. Fixed `w-28`/`w-44` filter inputs become `w-full sm:w-44`. `[color-scheme:dark]` so native pickers/scrollbars render dark.

**Modals → sheets.** Native `<dialog>` keeps logic but restyles by viewport:
  - Mobile: bottom sheet — `fixed inset-x-0 bottom-0 m-0 w-full max-w-none rounded-t-[--r-2xl] max-h-[90dvh]`, body `overflow-y-auto`, footer actions sticky at the bottom inside the sheet, `pb-[env(safe-area-inset-bottom)]`.
  - Desktop: centered card — `max-w-lg/2xl m-4 max-h-[90dvh] overflow-y-auto rounded-[--r-xl]`.
  - Backdrop `bg-black/60`; `dialog{color-scheme:dark}`. Close button is a `.tap` target.

**Chips / badges** — `text-caption` on `--*-tint` background with matching ink; status as dot+label. Filter chips are `.tap` height with `px-3`.

**FAB (optional, mobile)** — primary create action `fixed bottom-[calc(64px+env(safe-area-inset-bottom)+12px)] right-4 .tap rounded-full shadow-2`.

---

## 5. Kanban → mobile (the centerpiece)

One data source, three renderings driven by the **board's own container width** (`@container`):
- **Phone (< ~640px container):** no horizontal scroll. A sticky **segmented stage control** (the existing `stage-control.tsx`) selects one stage; below it, a **vertical stacked card list** for that stage. Stage change on a card = bottom sheet, not drag.
- **Tablet:** 2 columns visible, horizontal scroll with **scroll-snap** per column, columns sized `min(80vw, 320px)` — never a fixed 1560px track.
- **Desktop:** full drag-and-drop columns. Keep the `<select>` re-stage fallback everywhere (touch can't HTML5-drag). `cursor-grab` only shown at desktop.

Remove `style={{minWidth: STAGES.length*260}}`. Columns: `flex-none w-[min(80vw,320px)]` on the scroll track; container query swaps to the stacked list at phone width.

---

## 6. Data tables → responsive

The 13-column contacts table and analytics fixed-width rows must not widen the page.
- **Mobile:** render a **grouped list / card** view (primary line = name, secondary = company • status • score, trailing chevron). Provide the same view-switch escape hatch deals already has (`deals-view-switcher.tsx`), defaulting mobile to the card view.
- **Desktop:** keep the table, but make the first column `sticky left-0` inside the `overflow-x-auto` so identity never scrolls away. Normalize cell padding to `px-4 py-3`.
- Analytics funnel/breakdown rows: drop fixed `w-28/w-24` columns under ~480px; stack label above the progress bar so the bar keeps width.

---

## 7. Motion & micro-interactions

- Transitions: opacity + transform only, `--dur-1/2` with `--ease`. No layout-thrashing animations.
- Perceived speed: optimistic UI on kanban re-stage and inline edits (update local state, reconcile on response) — never full-list refetch on a single mutation.
- Use Next streaming + `loading.tsx` skeletons (already present per route) so navigation feels instant. Skeletons match final layout to avoid shift.
- View Transitions (React 19 `<ViewTransition>` / `document.startViewTransition` fallback) for route/detail transitions where cheap; always behind the reduced-motion guard.

---

## 8. Accessibility & quality gate (definition of done per ticket)

- No horizontal scroll at 320 / 360 / 390 / 768 / 1024 / 1440px.
- Every interactive element ≥ 44px and reachable by keyboard; visible focus ring (`outline` using `--accent`).
- Form errors set `aria-invalid` + `aria-describedby`; dialogs trap focus, restore on close, close on Esc.
- Color is never the only signal (status uses dot+label).
- `prefers-reduced-motion` respected.
- `next build` passes; no new console errors; no TypeScript errors.
- Lighthouse mobile: no CLS from late-loading chrome; LCP element is server-rendered.

---

## 9. Migration discipline

- Tokenize incrementally. A screen ticket may keep `bg-neutral-*` utilities until that screen's ticket touches it, but new markup uses tokens.
- Never regress a screen already migrated. If a foundation token changes, sweep dependent screens in the same or next ticket.
- Keep diffs small and reversible. One screen or one concern per ticket.
