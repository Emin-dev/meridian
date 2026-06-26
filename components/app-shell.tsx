"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/login/actions";
import { GlobalSearch } from "@/components/global-search";
import { useOverlayDismiss } from "@/hooks/use-overlay-dismiss";
import {
  DashboardIcon,
  UsersIcon,
  DollarSignIcon,
  ActivityIcon,
  CheckSquareIcon,
  MailIcon,
  BarChartIcon,
  SparklesIcon,
  SettingsIcon,
  SearchIcon,
  MenuIcon,
} from "@/components/icons";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: <DashboardIcon size={18} aria-hidden="true" /> },
  { href: "/contacts", label: "Contacts", icon: <UsersIcon size={18} aria-hidden="true" /> },
  { href: "/deals", label: "Deals", icon: <DollarSignIcon size={18} aria-hidden="true" /> },
  { href: "/activity", label: "Activity", icon: <ActivityIcon size={18} aria-hidden="true" /> },
  { href: "/tasks", label: "Tasks", icon: <CheckSquareIcon size={18} aria-hidden="true" /> },
  { href: "/sequences", label: "Sequences", icon: <MailIcon size={18} aria-hidden="true" /> },
  { href: "/analytics", label: "Analytics", icon: <BarChartIcon size={18} aria-hidden="true" /> },
  { href: "/ask", label: "Ask AI", icon: <SparklesIcon size={18} aria-hidden="true" /> },
  { href: "/settings", label: "Settings", icon: <SettingsIcon size={18} aria-hidden="true" /> },
];

export default function AppShell({ children, overdueCount = 0, overdueTaskCount = 0 }: { children: React.ReactNode; overdueCount?: number; overdueTaskCount?: number }) {
  const [navOpen, setNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [isMac, setIsMac] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad|iPod/.test(navigator.platform));
  }, []);

  // Close the mobile drawer on navigation.
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const pageLabel = NAV.find((n) => pathname === n.href || pathname.startsWith(n.href + "/"))?.label ?? "Meridian";

  const overdueTotal = overdueCount + overdueTaskCount;

  return (
    <div className="flex h-dvh bg-[--bg] text-[--ink-1] overflow-hidden">
      {/* Desktop sidebar (lg+) — permanent, in-flow. Mobile uses the slide-in drawer (one menu) instead. */}
      <aside
        aria-label="Navigation"
        className="hidden w-60 shrink-0 flex-col bg-[--surface-1] border-r border-[--line-1] lg:flex"
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-[--line-1] shrink-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[--accent] text-sm font-bold text-[--accent-ink]">
            M
          </div>
          <span className="text-sm font-semibold tracking-tight text-[--ink-1]">Meridian</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const badge =
              item.href === "/activity" && overdueCount > 0
                ? overdueCount
                : item.href === "/tasks" && overdueTaskCount > 0
                ? overdueTaskCount
                : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "press flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
                  active
                    ? "bg-[--accent] text-[--accent-ink]"
                    : "text-[--ink-2] hover:bg-[--surface-2] hover:text-[--ink-1]",
                ].join(" ")}
              >
                <span className="shrink-0">{item.icon}</span>
                {item.label}
                {badge > 0 && (
                  <span className="ml-auto inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[--bad] px-1 text-xs font-semibold text-[--accent-ink]">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        <div className="shrink-0 border-t border-[--line-1] px-4 py-3 flex items-center justify-between">
          <p className="text-xs text-[--ink-3]">v0.1.0</p>
          <form action={logout}>
            <button
              type="submit"
              className="text-xs text-[--ink-3] transition-colors hover:text-[--ink-1]"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="sticky top-0 z-30 glass border-b border-[--line-1] flex items-center gap-3 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
          {/* Hamburger — opens the mobile nav drawer (one menu, <lg only) */}
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={navOpen}
            aria-controls="mobile-nav-drawer"
            className="tap press relative -ml-1 flex items-center justify-center rounded-lg text-[--ink-2] hover:text-[--ink-1] lg:hidden"
          >
            <MenuIcon size={20} aria-hidden="true" />
            {overdueTotal > 0 && (
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[--bad] ring-2 ring-[--bg]" aria-hidden="true" />
            )}
          </button>
          <h1 className="flex-1 truncate min-w-0 text-sm font-semibold text-[--ink-1]">{pageLabel}</h1>
          <button
            onClick={() => setSearchOpen(true)}
            className="tap press flex items-center gap-2 rounded-lg border border-[--line-1] bg-[--surface-2] px-3 text-xs text-[--ink-2] hover:border-[--line-2] hover:text-[--ink-1]"
            aria-label="Open search"
          >
            <SearchIcon size={13} aria-hidden="true" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden rounded border border-[--line-1] px-1 font-mono text-xs sm:inline">
              {isMac ? "⌘K" : "Ctrl+K"}
            </kbd>
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto px-4 pt-4 sm:px-6 sm:pt-6 pb-6">
          {children}
        </main>
      </div>

      {/* Mobile nav drawer — the single mobile menu (full nav, <lg only) */}
      <MobileNavDrawer
        open={navOpen}
        onClose={() => setNavOpen(false)}
        pathname={pathname}
        overdueCount={overdueCount}
        overdueTaskCount={overdueTaskCount}
      />

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

function MobileNavDrawer({
  open,
  onClose,
  pathname,
  overdueCount,
  overdueTaskCount,
}: {
  open: boolean;
  onClose: () => void;
  pathname: string;
  overdueCount: number;
  overdueTaskCount: number;
}) {
  const panelRef = useOverlayDismiss<HTMLDivElement>(open, onClose);

  if (!open) return null;

  return (
    <div id="mobile-nav-drawer" className="lg:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel — slides in from the left */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        // Explicit opaque background: the `bg-[--token]` shorthand is a no-op in
        // this Tailwind v4 setup, which is invisible for the in-flow sidebar (it
        // sits over the near-identical dark body) but would let page content bleed
        // through this overlay drawer.
        style={{ backgroundColor: "var(--surface-1)" }}
        className="animate-drawer-in fixed inset-y-0 left-0 z-50 flex w-[min(80vw,18rem)] flex-col border-r border-[--line-1] shadow-[--shadow-3] pb-[env(safe-area-inset-bottom)]"
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-[--line-1] shrink-0 pt-[calc(1rem+env(safe-area-inset-top))]">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[--accent] text-sm font-bold text-[--accent-ink]">
            M
          </div>
          <span className="text-sm font-semibold tracking-tight text-[--ink-1]">Meridian</span>
        </div>

        {/* Nav — full nav, same as the desktop sidebar */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const badge =
              item.href === "/activity" && overdueCount > 0
                ? overdueCount
                : item.href === "/tasks" && overdueTaskCount > 0
                ? overdueTaskCount
                : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={onClose}
                className={[
                  "press flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm font-medium",
                  active
                    ? "bg-[--accent] text-[--accent-ink]"
                    : "text-[--ink-2] hover:bg-[--surface-2] hover:text-[--ink-1]",
                ].join(" ")}
              >
                <span className="shrink-0">{item.icon}</span>
                {item.label}
                {badge > 0 && (
                  <span className="ml-auto inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[--bad] px-1 text-xs font-semibold text-[--accent-ink]">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer — Sign out */}
        <div className="shrink-0 border-t border-[--line-1] px-2 py-2">
          <form action={logout}>
            <button
              type="submit"
              className="press flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-[--ink-2] hover:bg-[--surface-2] hover:text-[--ink-1]"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
