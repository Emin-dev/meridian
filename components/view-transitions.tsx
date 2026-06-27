"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Wraps App Router *soft* navigations in `document.startViewTransition` so the
 * root cross-fade defined in `globals.css` (`::view-transition-old/new(root)`)
 * plays on client-side route changes too — not just full-document loads, which
 * the CSS `@view-transition { navigation: auto }` rule already covers.
 *
 * Mechanism: a single capture-phase click listener intercepts internal anchor
 * clicks (Next `<Link>` renders an `<a>`), starts a view transition, and pushes
 * the route itself. `stopImmediatePropagation` keeps React's delegated
 * bubble-phase handler — i.e. Link's own navigation — from firing, so there is
 * no double navigation.
 *
 * Gating: skipped entirely when the View Transitions API is unsupported or the
 * user prefers reduced motion, so those cases degrade to an instant cut. Renders
 * nothing; mount once inside the app layout.
 */
export default function ViewTransitions() {
  const router = useRouter();
  const pathname = usePathname();
  // Resolver for the in-flight transition's update promise. Holding the new
  // snapshot until the route actually commits is what makes old→new animate.
  const finishRef = useRef<(() => void) | null>(null);

  // The new route has rendered — release the pending transition so the API
  // captures the new state and runs the cross-fade.
  useEffect(() => {
    finishRef.current?.();
  }, [pathname]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    // Feature check — unsupported browsers fall through to native navigation.
    if (!("startViewTransition" in document)) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const onClick = (e: MouseEvent) => {
      // Honour reduced motion live (the OS setting can change mid-session).
      if (reduceMotion.matches) return;
      // Let modified / non-primary clicks keep their default browser behaviour.
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      )
        return;

      const anchor =
        e.target instanceof Element ? e.target.closest("a") : null;
      if (!(anchor instanceof HTMLAnchorElement)) return;

      // Skip new-tab, download, and explicitly external links.
      if (
        (anchor.target && anchor.target !== "_self") ||
        anchor.hasAttribute("download") ||
        anchor.getAttribute("rel")?.includes("external")
      )
        return;

      const rawHref = anchor.getAttribute("href");
      if (!rawHref || rawHref.startsWith("#")) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      // Same-origin internal navigations only; ignore in-page anchors and
      // clicks that don't actually change the location.
      if (url.origin !== window.location.origin) return;
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      )
        return;

      // Take over: prevent the browser default and stop the event before
      // React's delegated bubble listener (Link's handler) can navigate again.
      e.preventDefault();
      e.stopImmediatePropagation();

      const dest = url.pathname + url.search + url.hash;

      document.startViewTransition(
        () =>
          new Promise<void>((resolve) => {
            let done = false;
            const finish = () => {
              if (done) return;
              done = true;
              if (finishRef.current === finish) finishRef.current = null;
              resolve();
            };
            finishRef.current = finish;
            // Safety net: never let the snapshot hang if the route commit
            // doesn't trigger the pathname effect (e.g. a no-op navigation).
            window.setTimeout(finish, 400);
            router.push(dest);
          })
      );
    };

    // Capture phase so this runs before React's bubble-phase delegation.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router]);

  return null;
}
