"use client";

import { useCallback, useEffect, useState, type ReactNode, type MouseEvent } from "react";

/**
 * Hash-based SPA router.
 * Routes look like: #/ , #/search?q=.. , #/property/ID , #/host/bookings , #/admin/users
 */

export type Route = {
  path: string; // e.g. "/property/123"
  params: URLSearchParams;
};

function parseHash(): Route {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const [path, qs] = raw.split("?");
  return { path: path || "/", params: new URLSearchParams(qs ?? "") };
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() =>
    typeof window === "undefined" ? { path: "/", params: new URLSearchParams() } : parseHash()
  );
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash());
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
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
