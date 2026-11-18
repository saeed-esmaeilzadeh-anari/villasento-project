"use client";

import { useSyncExternalStore, type ReactNode, type MouseEvent } from "react";

/**
 * Hash-based SPA router.
 * Routes look like: #/ , #/search?q=.. , #/property/ID , #/host/bookings , #/admin/users
 *
 * Hydration contract:
 *   The URL fragment (#/...) is NEVER sent to the server, so the server always
 *   renders the "/" (home) route. `useSyncExternalStore` guarantees the first
 *   client render uses the SAME server snapshot (home) — the real hash route is
 *   resolved by React right AFTER hydration completes. That kills the
 *   server-home vs client-property/account hydration mismatch, while deep
 *   links (#/property/123) still land on the right view one tick after mount.
 */

export type Route = {
  path: string; // e.g. "/property/123"
  params: URLSearchParams;
};

/** Stable server/first-render snapshot (never mutated anywhere). */
const HOME_ROUTE: Route = { path: "/", params: new URLSearchParams() };

function parseHash(): Route {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const [path, qs] = raw.split("?");
  return { path: path || "/", params: new URLSearchParams(qs ?? "") };
}

/** parseHash() must NOT be called directly as a snapshot (new object per call
 *  → "getSnapshot should be cached" infinite loop); cache per raw hash. */
let snapshotCache: { raw: string; route: Route } | null = null;

function getSnapshot(): Route {
  const raw = window.location.hash;
  if (!snapshotCache || snapshotCache.raw !== raw) {
    snapshotCache = { raw, route: parseHash() };
  }
  return snapshotCache.route;
}

function getServerSnapshot(): Route {
  return HOME_ROUTE;
}

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function navigate(to: string, opts?: { replace?: boolean; keepScroll?: boolean }) {
  const clean = to.startsWith("#") ? to.slice(1) : to;
  const target = "#" + (clean.startsWith("/") ? clean : "/" + clean);
  if (opts?.replace) {
    const url = window.location.href.split("#")[0] + target;
    window.history.replaceState(null, "", url);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else if (window.location.hash === target) {
    return;
  } else {
    window.location.hash = target;
  }
  if (!opts?.keepScroll) window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
}

export function Link({
  to,
  children,
  className,
  onClick,
  ...rest
}: {
  to: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "onClick">) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    onClick?.();
    navigate(to);
  };
  return (
    <a href={"#" + to} className={className} onClick={handle} {...rest}>
      {children}
    </a>
  );
}

/** Build a query string skipping empty values */
export function qs(obj: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}
