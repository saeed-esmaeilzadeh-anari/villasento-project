"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRoute } from "@/lib/router";
import { useAuth, useHistory, useCompare } from "@/lib/store";
import { ThemeProvider, themeUserChanged } from "@/components/theme/ThemeProvider";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Header, DemoHint } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { HomeView } from "@/views/HomeView";
import { SearchView } from "@/views/SearchView";
import { PropertyView } from "@/views/PropertyView";
import { ListingForm } from "@/views/ListingForm";
import { AccountView, FavoritesView, ConversationView } from "@/views/AccountView";
import { CompareView } from "@/views/CompareView";
import { ArticlesView, ArticleView } from "@/views/ArticlesView";
import { AdminView } from "@/views/AdminView";
import { CmsPageView, NotFoundView } from "@/views/CmsPageView";

function AppShell() {
  const route = useRoute();
  const { fetchMe, openAuth, me } = useAuth();
  const pushHistory = useHistory((s) => s.push);

  useEffect(() => {
    // Controlled zustand persistence: both persisted stores use skipHydration,
    // so localStorage values are merged ONLY after React hydration — the first
    // client render always matches the server markup (no badge/count mismatch).
    useCompare.persist.rehydrate();
    useHistory.persist.rehydrate();
    fetchMe();
  }, [fetchMe]);

  // restore per-user theme preferences from the database on login/logout
  const meId = useAuth((s) => s.me?.id ?? null);
  useEffect(() => {
    themeUserChanged(meId);
  }, [meId]);

  // warn once when the (bootstrap) admin must change the initial password
  const mustChange = useAuth((s) => s.me?.mustChangePassword ?? false);
  useEffect(() => {
    if (mustChange) toast.warning("برای امنیت حساب، لطفاً رمز عبور اولیه را تغییر دهید (پنل کاربری → تغییر رمز)");
  }, [mustChange]);

  // auto-open auth when redirected with ?auth=1
  useEffect(() => {
    if (route.params.get("auth") === "1") openAuth();
     
  }, [route.params]);

  // Legacy public hash links must resolve to real, server-rendered Next.js routes.
  useEffect(() => {
    if (route.path === "/articles") {
      window.location.replace("/articles");
      return;
    }
    const match = route.path.match(/^\/(property|article|page)\/([^/]+)$/);
    if (!match) return;
    let segment = match[2];
    try { segment = decodeURIComponent(segment); } catch { /* keep original segment */ }
    window.location.replace("/" + match[1] + "/" + encodeURIComponent(segment));
  }, [route.path]);

  const path = route.path;

  const isPanel = path.startsWith("/host") || path.startsWith("/admin") || path.startsWith("/account") || path.startsWith("/new-listing");

  let view: React.ReactNode;
  if (path === "/" || path === "") view = <HomeView />;
  else if (path === "/search") view = <SearchView />;
  else if (/^\/property\/[^/]+$/.test(path)) view = <PropertyView />;
  else if (path === "/new-listing") view = <ListingForm />;
  else if (/^\/new-listing\/[^/]+$/.test(path)) view = <ListingForm editId={path.split("/")[2]} />;
  else if (path === "/compare") view = <CompareView />;
  else if (path === "/favorites") view = <FavoritesView />;
  else if (path === "/articles") view = <ArticlesView />;
  else if (/^\/article\/[^/]+$/.test(path)) view = <ArticleView slug={path.split("/")[2]} />;
  else if (/^\/page\/[^/]+$/.test(path)) view = <CmsPageView />;
  else if (path === "/account" || /^\/account\/[a-z-]+$/.test(path)) view = <AccountView tab={path === "/account" ? undefined : path.split("/")[2]} />;
  else if (/^\/account\/messages\/[^/]+$/.test(path)) view = <ConversationView id={path.split("/")[3]} />;
  else if (/^\/admin(\/[a-z-]+)?$/.test(path)) view = <AdminView section={path === "/admin" ? undefined : path.split("/")[2]} />;
  else view = <NotFoundView />;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">{view}</main>
      <Footer />
      {!isPanel && <DemoHint />}
    </div>
  );
}

/** Small effect-holder: runs side-effects that need `me` (kept out of AppShell render) */
function HistorySync() {
  const me = useAuth((s) => s.me);
  const ids = useHistory((s) => s.ids);
  useEffect(() => {
    // fire-and-forget: refresh favourites badge etc. — reserved for future sync
    if (me && ids.length > 0) {
      api.get(`/api/properties?ids=${ids.slice(0, 4).join(",")}`).catch(() => {});
    }
     
  }, [me?.id]);
  return null;
}

export default function Page() {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, refetchOnWindowFocus: false },
        },
      })
  );
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider />
      <AppShell />
      <HistorySync />
    </QueryClientProvider>
  );
}
