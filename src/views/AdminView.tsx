"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { navigate } from "@/lib/router";
import { useAuth } from "@/lib/store";
import { useSeo } from "@/lib/seo";
import { faNum, faDateTime } from "@/lib/fa";
import { StatCard, EmptyState } from "@/components/site/misc";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LayoutDashboard, ListChecks, Users, Briefcase, CalendarClock, MessagesSquare,
  Newspaper, Settings, ScrollText, Download, ShieldCheck, Eye, PlusCircle, UserPlus,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Link } from "@/lib/router";
import { cn } from "@/lib/utils";
import { ListingsSection } from "./admin/Listings";
import { UsersSection } from "./admin/Users";
import { AgentsSection } from "./admin/Agents";
import { RequestsSection } from "./admin/Requests";
import { CmsSection } from "./admin/Cms";
import { SettingsSection } from "./admin/Settings";
import { AuditSection } from "./admin/Audit";

const SECTIONS = [
  { key: "dashboard", label: "داشبورد", icon: LayoutDashboard },
  { key: "listings", label: "مدیریت آگهی‌ها", icon: ListChecks },
  { key: "users", label: "کاربران", icon: Users },
  { key: "agents", label: "مشاوران", icon: Briefcase },
  { key: "requests", label: "درخواست‌ها و پیام‌ها", icon: CalendarClock },
  { key: "cms", label: "مدیریت محتوا", icon: Newspaper },
  { key: "settings", label: "تنظیمات سامانه", icon: Settings },
  { key: "audit", label: "لاگ فعالیت‌ها", icon: ScrollText },
];

export function AdminView({ section }: { section?: string }) {
  const { me, loading } = useAuth();
  const active = section ?? "dashboard";

  useSeo({ title: "داشبورد مدیریت | ویلاسنتو", noIndex: true });

  useEffect(() => {
    if (!loading && (!me || !["ADMIN", "SUPER_ADMIN"].includes(me.role))) navigate("/?auth=1");
  }, [loading, me]);

  if (!me || !["ADMIN", "SUPER_ADMIN"].includes(me.role)) {
    return <div className="mx-auto max-w-lg px-4 py-24"><Skeleton className="h-40 rounded-2xl" /></div>;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-black flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> پنل مدیریت ویلاسنتو
          </h1>
          <p className="text-xs text-muted-foreground mt-1">{me.fullName ?? faNum(me.phone)} · {me.role === "SUPER_ADMIN" ? "مدیر ارشد" : "مدیر"}</p>
        </div>
        <a href="/api/admin/export?entity=listings" className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold hover:border-primary/40 hover:text-primary transition-colors">
          <Download className="h-4 w-4" /> خروجی Excel آگهی‌ها
        </a>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* sidebar */}
        <aside className="lg:w-60 shrink-0">
          <nav className="flex lg:flex-col gap-1.5 overflow-x-auto pb-2 lg:pb-0" aria-label="بخش‌های مدیریت">
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                onClick={() => navigate(`/admin/${s.key}`)}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-bold whitespace-nowrap transition-colors",
                  active === s.key ? "bg-primary text-primary-foreground shadow" : "hover:bg-muted border bg-card"
                )}
                aria-current={active === s.key ? "page" : undefined}
              >
                <s.icon className="h-4 w-4" /> {s.label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex-1 min-w-0">
          {active === "dashboard" && <Dashboard />}
          {active === "listings" && <ListingsSection />}
          {active === "users" && <UsersSection />}
          {active === "agents" && <AgentsSection />}
          {active === "requests" && <RequestsSection />}
          {active === "cms" && <CmsSection />}
          {active === "settings" && <SettingsSection />}
          {active === "audit" && <AuditSection />}
        </div>
      </div>
    </div>
  );
}

// ───────────────── Dashboard (real stats) ─────────────────
type Overview = {
  kpis: {
    propsTotal: number; propsPublished: number; propsPending: number; propsRejected: number;
    propsExpired: number; propsDraft: number;
    usersTotal: number; agentsTotal: number; ownersTotal: number;
    visitsTotal: number; visitsNew: number; messagesNew: number; reportsOpen: number;
    viewsTotal: number; viewsMonth: number; listingsMonth: number; usersMonth: number;
  };
};

const CHART_COLORS = ["#0d5c46", "#1a8f6e", "#3fbf98", "#d4a017", "#c0392b", "#7f8c8d", "#2c3e50", "#8e44ad"];

function Dashboard() {
  const overview = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => api.get<Overview>("/api/admin/overview"),
  });
  const charts = useQuery({
    queryKey: ["admin-charts"],
    queryFn: () => api.get<{
      series: { date: string; views: number; listings: number; users: number }[];
      byType: { label: string; count: number }[];
      byTransactionType: { label: string; count: number }[];
      byStatus: { label: string; count: number }[];
      topViewed: { id: string; title: string; viewCount: number }[];
    }>("/api/admin/charts?days=30"),
  });
  const recents = useQuery({
    queryKey: ["admin-recents"],
    queryFn: () => api.get<{
      latestListings: { id: string; title: string; code: string; status: string; city: { name: string }; host: { fullName: string | null; phone: string }; createdAt: string; images: { url: string }[] }[];
      latestVisits: { id: string; code: string; name: string; status: string; property: { title: string }; createdAt: string }[];
      latestMessages: { id: string; name: string; body: string; status: string; createdAt: string }[];
      latestAudit: { id: string; action: string; actorPhone: string | null; actor: { fullName: string | null } | null; createdAt: string }[];
      latestUsers: { id: string; fullName: string | null; phone: string; role: string; createdAt: string }[];
    }>("/api/admin/recents"),
  });

  if (overview.isLoading) {
    return <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>;
  }
  const k = overview.data?.kpis;

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="کل املاک" value={k?.propsTotal ?? 0} icon={<ListChecks className="h-5 w-5" />} tone="primary" />
        <StatCard title="منتشرشده" value={k?.propsPublished ?? 0} icon={<Eye className="h-5 w-5" />} />
        <StatCard title="در انتظار تأیید" value={k?.propsPending ?? 0} icon={<PlusCircle className="h-5 w-5" />} tone="warning" hint="نیازمند بررسی" />
        <StatCard title="ردشده" value={k?.propsRejected ?? 0} icon={<ListChecks className="h-5 w-5" />} tone="danger" />
        <StatCard title="منقضی‌شده" value={k?.propsExpired ?? 0} icon={<ListChecks className="h-5 w-5" />} />
        <StatCard title="کاربران" value={k?.usersTotal ?? 0} icon={<Users className="h-5 w-5" />} hint={`${faNum(k?.usersMonth ?? 0)} کاربر جدید این ماه`} />
        <StatCard title="مشاوران" value={k?.agentsTotal ?? 0} icon={<Briefcase className="h-5 w-5" />} hint={`${faNum(k?.ownersTotal ?? 0)} مالک`} />
        <StatCard title="درخواست بازدید" value={k?.visitsTotal ?? 0} icon={<CalendarClock className="h-5 w-5" />} tone="warning" hint={`${faNum(k?.visitsNew ?? 0)} جدید`} />
        <StatCard title="پیام‌های جدید" value={k?.messagesNew ?? 0} icon={<MessagesSquare className="h-5 w-5" />} tone="warning" />
        <StatCard title="گزارش آگهی باز" value={k?.reportsOpen ?? 0} icon={<ScrollText className="h-5 w-5" />} tone="danger" />
        <StatCard title="مجموع بازدید آگهی‌ها" value={k?.viewsTotal ?? 0} icon={<Eye className="h-5 w-5" />} hint={`${faNum(k?.viewsMonth ?? 0)} این ماه`} />
        <StatCard title="آگهی‌های این ماه" value={k?.listingsMonth ?? 0} icon={<PlusCircle className="h-5 w-5" />} />
      </div>

      {/* charts */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl border bg-card p-4">
          <h3 className="font-black text-sm mb-3">بازدید املاک، ثبت آگهی و کاربران جدید (۳۰ روز)</h3>
          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts.data?.series ?? []}>
                <defs>
                  <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0d5c46" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#0d5c46" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gl" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d4a017" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#d4a017" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(v: string) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} width={32} />
                <Tooltip contentStyle={{ direction: "rtl", fontSize: 12, borderRadius: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11, direction: "rtl" }} />
                <Area type="monotone" dataKey="views" name="بازدید" stroke="#0d5c46" fill="url(#gv)" strokeWidth={2} />
                <Area type="monotone" dataKey="listings" name="آگهی جدید" stroke="#d4a017" fill="url(#gl)" strokeWidth={2} />
                <Area type="monotone" dataKey="users" name="کاربر جدید" stroke="#3fbf98" fillOpacity={0.06} fill="#3fbf98" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4">
          <h3 className="font-black text-sm mb-3">توزیع وضعیت آگهی‌ها</h3>
          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={charts.data?.byStatus ?? []} dataKey="count" nameKey="label" innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {(charts.data?.byStatus ?? []).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ direction: "rtl", fontSize: 12, borderRadius: 12 }} />
                <Legend wrapperStyle={{ fontSize: 10, direction: "rtl" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* recent listings */}
        <div className="lg:col-span-2 rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-black text-sm">آخرین آگهی‌های ثبت‌شده</h3>
            <button className="text-xs text-primary hover:underline" onClick={() => navigate("/admin/listings")}>مدیریت آگهی‌ها</button>
          </div>
          <div className="space-y-2.5">
            {(recents.data?.latestListings ?? []).map((l) => (
              <div key={l.id} className="flex items-center gap-3">
                <span className="w-12 h-10 rounded-lg bg-muted overflow-hidden shrink-0">
                  {l.images[0] && <img src={l.images[0].url} alt={l.title} className="h-full w-full object-cover" />}
                </span>
                <div className="min-w-0 flex-1">
                  <Link to={`/property/${l.id}`} className="text-xs font-bold line-clamp-1 hover:text-primary">{l.title}</Link>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{l.city.name} · {l.host.fullName ?? l.host.phone} · {faDateTime(l.createdAt)}</div>
                </div>
                <span className="text-[10px] rounded-full bg-muted px-2 py-1 shrink-0">{l.status === "PENDING" ? "در انتظار" : l.status === "PUBLISHED" ? "منتشرشده" : l.status}</span>
              </div>
            ))}
            {!recents.data && <Skeleton className="h-32 rounded-xl" />}
          </div>
        </div>

        {/* new requests */}
        <div className="rounded-2xl border bg-card p-4">
          <h3 className="font-black text-sm mb-3">درخواست‌ها و پیام‌های جدید</h3>
          <div className="space-y-2.5">
            {(recents.data?.latestVisits ?? []).slice(0, 3).map((v) => (
              <div key={v.id} className="text-xs">
                <div className="font-bold flex items-center gap-1.5">
                  <CalendarClock className="h-3.5 w-3.5 text-primary" /> بازدید {v.code}
                </div>
                <div className="text-muted-foreground line-clamp-1 mt-0.5">{v.name} — {v.property.title}</div>
              </div>
            ))}
            {(recents.data?.latestMessages ?? []).slice(0, 3).map((m) => (
              <div key={m.id} className="text-xs">
                <div className="font-bold flex items-center gap-1.5">
                  <MessagesSquare className="h-3.5 w-3.5 text-primary" /> پیام {m.name}
                </div>
                <div className="text-muted-foreground line-clamp-1 mt-0.5">{m.body}</div>
              </div>
            ))}
            {!recents.data && <Skeleton className="h-28 rounded-xl" />}
          </div>
        </div>
      </div>

      {/* recent audit */}
      <div className="rounded-2xl border bg-card p-4">
        <h3 className="font-black text-sm mb-3">آخرین فعالیت‌های کاربران</h3>
        <div className="grid md:grid-cols-2 gap-2">
          {(recents.data?.latestAudit ?? []).map((a) => (
            <div key={a.id} className="flex items-center justify-between text-xs rounded-lg bg-muted/50 px-3 py-2">
              <span className="font-bold">{a.action}</span>
              <span className="text-muted-foreground">{a.actor?.fullName ?? a.actorPhone ?? "سیستم"} · {faDateTime(a.createdAt)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

