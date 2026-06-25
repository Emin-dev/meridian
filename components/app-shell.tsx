"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/login/actions";
import { GlobalSearch } from "@/components/global-search";
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
  MenuIcon,
  SearchIcon,
  MoreIcon,
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

// Bottom tab bar shows the 4 primary destinations + More
const BOTTOM_TABS = NAV.slice(0, 4);

export default function AppShell({ children, overdueCount = 0, overdueTaskCount = 0 }: { children: React.ReactNode; overdueCount?: number; overdueTaskCount?: number }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [isMac, setIsMac] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad|iPod/.test(navigator.platform));
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [mobileOpen]);

  const pageLabel = NAV.find((n) => pathname === n.href || pathname.startsWith(n.href + "/"))?.label ?? "Meridian";

  // "More" is active when the current route isn't one of the 4 primary tabs
  const isMoreActive = !BOTTOM_TABS.some(
    (tab) => pathname === tab.href || pathname.startsWith(tab.href + "/")
  );

  return (
    <div className="flex h-dvh bg-neutral-950 text-neutral-100 overflow-hidden">
      {/* Bottom tab bar — rendered before overlay so overlay stacks above it (same z-40, DOM order wins) */}
      <nav
        aria-label="Mobile navigation"
        className="fixed bottom-0 inset-x-0 z-40 lg:hidden glass border-t border-[--line-1] pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex items-stretch">
          {BOTTOM_TABS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const badge =
              item.href === "/activity" && overdueCount > 0
                ? overdueCount
                : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                aria-current={active ? "page" : undefined}
                className="tap press flex flex-1 flex-col items-center justify-center gap-0.5 py-2 relative"
                style={{ color: active ? "var(--accent)" : "var(--ink-2)" }}
              >
                <span
                  className={[
                    "flex items-center justify-center rounded-full px-3 py-1 relative",
                    active ? "bg-[--accent-tint]" : "",
                  ].join(" ")}
                >
                  {item.icon}
                  {badge > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-0.5 text-[10px] font-semibold text-white leading-none">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </span>
                <span className="text-caption leading-none">{item.label}</span>
              </Link>
            );
          })}

          {/* More — opens the full 8-item drawer */}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="More navigation options"
            aria-expanded={mobileOpen}
            className="tap press flex flex-1 flex-col items-center justify-center gap-0.5 py-2"
            style={{ color: isMoreActive ? "var(--accent)" : "var(--ink-2)" }}
          >
            <span
              className={[
                "flex items-center justify-center rounded-full px-3 py-1",
                isMoreActive ? "bg-[--accent-tint]" : "",
              ].join(" ")}
            >
              <MoreIcon size={20} aria-hidden="true" />
            </span>
            <span className="text-caption leading-none">More</span>
          </button>
        </div>
      </nav>

      {/* Mobile overlay — same z-40 but later in DOM, so appears above bottom tab bar */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-neutral-900 border-r border-neutral-800 transition-transform duration-200 ease-in-out",
          "lg:relative lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-neutral-800 shrink-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600 text-sm font-bold text-white">
            M
          </div>
          <span className="text-sm font-semibold tracking-tight text-neutral-100">Meridian</span>
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
                onClick={() => setMobileOpen(false)}
                className={[
                  "press flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
                  active
                    ? "bg-indigo-600 text-white"
                    : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100",
                ].join(" ")}
              >
                <span className="shrink-0">{item.icon}</span>
                {item.label}
                {badge > 0 && (
                  <span className="ml-auto inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1 text-xs font-semibold text-white">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        <div className="shrink-0 border-t border-neutral-800 px-4 py-3 flex items-center justify-between">
          <p className="text-xs text-neutral-600">v0.1.0</p>
          <form action={logout}>
            <button
              type="submit"
              className="text-xs text-neutral-500 transition-colors hover:text-neutral-300"
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
          <button
            className="tap press flex items-center justify-center rounded-lg text-[--ink-2] hover:bg-[--surface-2] hover:text-[--ink-1] lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <MenuIcon size={20} aria-hidden="true" />
          </button>
          <h1 className="flex-1 truncate min-w-0 text-sm font-semibold text-neutral-100">{pageLabel}</h1>
          <button
            onClick={() => setSearchOpen(true)}
            className="tap press flex items-center gap-2 rounded-lg border border-[--line-1] bg-[--surface-2] px-3 text-xs text-[--ink-2] hover:border-[--line-2] hover:text-[--ink-1]"
            aria-label="Open search"
          >
            <SearchIcon size={13} aria-hidden="true" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden rounded border border-neutral-600 px-1 font-mono text-xs sm:inline">
              {isMac ? "⌘K" : "Ctrl+K"}
            </kbd>
          </button>
        </header>

        {/* Page content — bottom padding reserves space for the tab bar on mobile */}
        <main className="flex-1 overflow-auto px-4 pt-4 sm:px-6 sm:pt-6 pb-[calc(72px+env(safe-area-inset-bottom))] lg:pb-6">
          {children}
        </main>
      </div>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
