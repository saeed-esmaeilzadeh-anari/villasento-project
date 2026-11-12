"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Me, type VisitT, type Lookups } from "@/lib/api";
import { Link, navigate } from "@/lib/router";
import { useAuth } from "@/lib/store";
import { useSeo } from "@/lib/seo";
import {
  faNum, faDateTime, shortMoney, priceLine, BRAND,
  LISTING_STATUS_LABELS, LISTING_STATUS_COLORS, VISIT_STATUS_LABELS, VISIT_STATUS_COLORS, ROLE_LABELS,
} from "@/lib/fa";
import { PropertyCard } from "@/components/site/PropertyCard";
import { PropertyStatusBadge, EmptyState, StatCard } from "@/components/site/misc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LayoutDashboard, ListChecks, Heart, CalendarClock, MessagesSquare, Bell,
  History, UserRound, PlusCircle, Eye, Trash2, Send, RefreshCcw, Pencil,
  KeyRound, Loader2, ShieldAlert, Clock3, MapPin, ChevronLeft, Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type MyListing = {
  id: string; code: string; title: string; typeLabel: string; ttLabel: string; transactionType: string;
  city: string; province: string; status: string; statusLabel: string; rejectionReason: string | null;
  salePrice: number | null; rahnAmount: number | null; rentAmount: number | null;
  viewCount: number; isFeatured: boolean; image: string | null;
  visitsCount: number; favoritesCount: number;
  publishedAt: string | null; expiresAt: string | null; createdAt: string;
};

const TABS = [
  { key: "overview", label: "نمای کلی", icon: LayoutDashboard },
  { key: "listings", label: "آگهی‌های من", icon: ListChecks },
  { key: "visits", label: "درخواست‌های بازدید", icon: CalendarClock },
  { key: "messages", label: "پیام‌ها", icon: MessagesSquare },
  { key: "favorites", label: "علاقه‌مندی‌ها", icon: Heart },
  { key: "activity", label: "تاریخچه فعالیت", icon: History },
  { key: "profile", label: "پروفایل و امنیت", icon: UserRound },
];

export function AccountView({ tab: tabProp }: { tab?: string }) {
  const { me, loading } = useAuth();
  // derive tab from prop when provided; local state otherwise
  const [tabState, setTab] = useState("overview");
  const tab = tabProp ?? tabState;

  useSeo({ title: "پنل کاربری | ویلاسنتو", path: "/account", noIndex: true });

  useEffect(() => {
    if (!loading && !me) navigate("/?auth=1");
  }, [loading, me]);

  if (!me) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24">
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-black">پنل کاربری {BRAND}</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {me.fullName ?? faNum(me.phone)} · {ROLE_LABELS[me.role] ?? me.role} {me.isHostVerified && "· تأییدشده"}
          </p>
        </div>
        <Button asChild>
          <Link to="/new-listing"><PlusCircle className="h-4 w-4" /> ثبت آگهی جدید</Link>
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v); window.location.hash = `#/account/${v}`; }} dir="rtl">
        <TabsList className="w-full justify-start overflow-x-auto h-auto flex-wrap gap-1 bg-transparent p-0">
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key} className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg border">
              <t.icon className="h-4 w-4" /> <span className="text-xs font-bold">{t.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-5"><OverviewTab me={me} onGo={setTab} /></TabsContent>
        <TabsContent value="listings" className="mt-5"><ListingsTab /></TabsContent>
        <TabsContent value="visits" className="mt-5"><VisitsTab /></TabsContent>
        <TabsContent value="messages" className="mt-5"><MessagesTab /></TabsContent>
        <TabsContent value="favorites" className="mt-5"><FavoritesTab /></TabsContent>
        <TabsContent value="activity" className="mt-5"><ActivityTab /></TabsContent>
        <TabsContent value="profile" className="mt-5"><ProfileTab me={me} /></TabsContent>
      </Tabs>
    </div>
  );
}

// ───────────────── Overview ─────────────────
function OverviewTab({ me, onGo }: { me: NonNullable<Me>; onGo: (t: string) => void }) {
  const { data: listings } = useQuery({
    queryKey: ["my-listings"],
    queryFn: () => api.get<{ items: MyListing[] }>("/api/me/listings"),
  });
  const { data: notif } = useQuery({
    queryKey: ["notifications", me.id],
    queryFn: () => api.get<{ items: { id: string; title: string; body: string; createdAt: string; link?: string | null }[]; unread: number }>("/api/notifications"),
  });

  const items = listings?.items ?? [];
  const totalViews = items.reduce((a, b) => a + b.viewCount, 0);
  const published = items.filter((x) => x.status === "PUBLISHED").length;
  const pending = items.filter((x) => x.status === "PENDING").length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="آگهی‌های من" value={items.length} icon={<ListChecks className="h-5 w-5" />} tone="primary" />
        <StatCard title="منتشرشده" value={published} icon={<Eye className="h-5 w-5" />} />
        <StatCard title="در انتظار تأیید" value={pending} icon={<Clock3 className="h-5 w-5" />} tone="warning" />
        <StatCard title="مجموع بازدید" value={totalViews} icon={<Eye className="h-5 w-5" />} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-black text-sm">آخرین آگهی‌ها</h3>
            <button className="text-xs text-primary hover:underline" onClick={() => onGo("listings")}>مشاهده همه</button>
          </div>
          {items.length === 0 ? (
            <EmptyState icon={<ListChecks className="h-8 w-8" />} title="هنوز آگهی ندارید" action={<Button size="sm" asChild><Link to="/new-listing">ثبت اولین آگهی</Link></Button>} />
          ) : (
            <div className="space-y-2.5">
              {items.slice(0, 4).map((l) => (
                <div key={l.id} className="flex items-center gap-3">
                  <span className="w-14 h-12 rounded-lg bg-muted overflow-hidden shrink-0">
                    {l.image && <img src={l.image} alt={l.title} className="h-full w-full object-cover" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold line-clamp-1">{l.title}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{faNum(l.viewCount)} بازدید · {l.statusLabel}</div>
                  </div>
                  <PropertyStatusBadge status={l.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border bg-card p-5">
          <div className="font-black text-sm mb-3">اعلان‌های اخیر</div>
          {(notif?.items ?? []).length === 0 ? (
            <EmptyState icon={<Bell className="h-8 w-8" />} title="اعلانی ندارید" />
          ) : (
            <div className="space-y-2.5">
              {notif!.items.slice(0, 5).map((n) => (
                <div key={n.id} className="text-xs">
                  <div className="font-bold">{n.title}</div>
                  <div className="text-muted-foreground line-clamp-1 mt-0.5">{n.body}</div>
                  <div className="text-[10px] text-muted-foreground/70 mt-0.5">{faDateTime(n.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ───────────────── My listings ─────────────────
function ListingsTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["my-listings"],
    queryFn: () => api.get<{ items: MyListing[] }>("/api/me/listings"),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["my-listings"] });
    qc.invalidateQueries({ queryKey: ["home"] });
  };

  const submitM = useMutation({
    mutationFn: (id: string) => api.post(`/api/properties/${id}/submit`),
    onSuccess: () => { toast.success("آگهی برای تأیید ارسال شد"); invalidate(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const extendM = useMutation({
    mutationFn: (id: string) => api.post(`/api/properties/${id}/extend`),
    onSuccess: () => { toast.success("آگهی تمدید شد"); invalidate(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const deleteM = useMutation({
    mutationFn: (id: string) => api.del(`/api/properties/${id}`),
    onSuccess: () => { toast.success("آگهی حذف شد"); invalidate(); },
    onError: (e) => toast.error((e as Error).message),
  });

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>;
  }

  const items = data?.items ?? [];
  if (!items.length) {
    return (
      <EmptyState
        icon={<ListChecks className="h-12 w-12" />}
        title="هنوز آگهی ثبت نکرده‌اید"
        desc="ملک خود را در چند مرحله ساده ثبت کنید تا توسط هزاران جستجوگر دیده شود."
        action={<Button asChild><Link to="/new-listing"><PlusCircle className="h-4 w-4" /> ثبت آگهی جدید</Link></Button>}
      />
    );
  }

  return (
    <div className="space-y-3">
      {items.map((l) => (
        <div key={l.id} className="rounded-2xl border bg-card p-4 flex flex-col md:flex-row md:items-center gap-4">
          <span className="w-full md:w-28 h-24 rounded-xl bg-muted overflow-hidden shrink-0">
            {l.image ? <img src={l.image} alt={l.title} className="h-full w-full object-cover" /> : <span className="grid place-items-center h-full text-muted-foreground text-xs">بدون تصویر</span>}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={cn("border text-[10px]", LISTING_STATUS_COLORS[l.status])}>{l.statusLabel}</Badge>
              {l.isFeatured && <Badge className="bg-amber-500 text-white text-[10px] border-amber-500">ویژه</Badge>}
              <span className="text-[11px] text-muted-foreground">کد: {l.code}</span>
            </div>
            <Link to={`/property/${l.id}`} className="font-bold text-sm mt-1.5 line-clamp-1 hover:text-primary transition-colors block">{l.title}</Link>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground mt-1.5">
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {l.province}، {l.city}</span>
              <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {faNum(l.viewCount)} بازدید</span>
              <span>{faNum(l.visitsCount)} درخواست بازدید</span>
              {l.expiresAt && l.status === "PUBLISHED" && <span>اعتبار تا: {faDateTime(l.expiresAt)}</span>}
              <span className="font-bold text-primary">{priceLine(l.transactionType, l.salePrice, l.rahnAmount, l.rentAmount)}</span>
            </div>
            {l.rejectionReason && (
              <p className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5 mt-2 leading-5">
                <ShieldAlert className="h-3.5 w-3.5 inline ml-0.5" /> دلیل رد: {l.rejectionReason}
              </p>
            )}
          </div>
          <div className="flex md:flex-col lg:flex-row flex-wrap gap-2 shrink-0">
            <Button size="sm" variant="outline" asChild><Link to={`/new-listing/${l.id}`}><Pencil className="h-3.5 w-3.5" /> ویرایش</Link></Button>
            {(l.status === "DRAFT" || l.status === "REJECTED" || l.status === "APPROVED") && (
              <Button size="sm" disabled={submitM.isPending} onClick={() => submitM.mutate(l.id)}><Send className="h-3.5 w-3.5" /> ارسال برای تأیید</Button>
            )}
            {(l.status === "EXPIRED" || l.status === "PUBLISHED") && (
              <Button size="sm" variant="secondary" disabled={extendM.isPending} onClick={() => extendM.mutate(l.id)}>
                <RefreshCcw className="h-3.5 w-3.5" /> تمدید
              </Button>
            )}
            {l.status !== "PUBLISHED" && (
              <Button size="sm" variant="destructive" disabled={deleteM.isPending} onClick={() => { if (window.confirm("آگهی حذف شود؟ این عمل بازگشت‌پذیر نیست.")) deleteM.mutate(l.id); }}>
                <Trash2 className="h-3.5 w-3.5" /> حذف
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ───────────────── Visits ─────────────────
function VisitsTab() {
  const qc = useQueryClient();
  const [detail, setDetail] = useState<VisitT | null>(null);
  const mine = useQuery({
    queryKey: ["my-visits"],
    queryFn: () => api.get<{ items: VisitT[] }>("/api/visits?scope=mine"),
  });
  const incoming = useQuery({
    queryKey: ["incoming-visits"],
    queryFn: () => api.get<{ items: VisitT[] }>("/api/visits?scope=incoming"),
  });

  const statusM = useMutation({
    mutationFn: (p: { id: string; status: string }) => api.patch("/api/visits", p),
    onSuccess: () => {
      toast.success("وضعیت به‌روزرسانی شد");
      qc.invalidateQueries({ queryKey: ["my-visits"] });
      qc.invalidateQueries({ queryKey: ["incoming-visits"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const VisitCard = ({ v, isIncoming }: { v: VisitT; isIncoming?: boolean }) => (
    <div className="rounded-2xl border bg-card p-4 flex items-center gap-3">
      <span className="w-16 h-14 rounded-lg bg-muted overflow-hidden shrink-0">
        {v.property.image && <img src={v.property.image} alt={v.property.title} className="h-full w-full object-cover" />}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={cn("border text-[10px]", VISIT_STATUS_COLORS[v.status])}>{VISIT_STATUS_LABELS[v.status] ?? v.statusLabel}</Badge>
          <span className="text-[10px] text-muted-foreground">کد: {v.code}</span>
        </div>
        <Link to={`/property/${v.property.id}`} className="text-xs font-bold line-clamp-1 mt-1 block hover:text-primary">{v.property.title}</Link>
        <div className="text-[11px] text-muted-foreground mt-1 flex flex-wrap gap-x-3">
          <span>{isIncoming ? `متقاضی: ${v.name} · ${faNum(v.phone)}` : `کد رهگیری: ${v.code}`}</span>
          {v.preferredAt && <span className="flex items-center gap-1"><CalendarClock className="h-3 w-3" /> {faDateTime(v.preferredAt)}</span>}
          <span>ثبت: {faDateTime(v.createdAt)}</span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 shrink-0">
        <Button size="sm" variant="ghost" onClick={() => setDetail(v)}>جزئیات</Button>
        {isIncoming && v.status === "NEW" && (
          <Button size="sm" variant="secondary" disabled={statusM.isPending} onClick={() => statusM.mutate({ id: v.id, status: "IN_PROGRESS" })}>شروع پیگیری</Button>
        )}
        {isIncoming && v.status === "IN_PROGRESS" && (
          <Button size="sm" disabled={statusM.isPending} onClick={() => statusM.mutate({ id: v.id, status: "DONE" })}>انجام شد</Button>
        )}
      </div>
    </div>
  );

  const hasIncoming = (incoming.data?.items.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      {hasIncoming && (
        <section>
          <h3 className="font-black text-sm mb-3">درخواست‌های دریافتی برای املاک من</h3>
          <div className="space-y-3">
            {incoming.data!.items.map((v) => <VisitCard key={v.id} v={v} isIncoming />)}
          </div>
        </section>
      )}
      <section>
        <h3 className="font-black text-sm mb-3">درخواست‌های من</h3>
        {mine.isLoading ? (
          <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
        ) : (mine.data?.items.length ?? 0) === 0 ? (
          <EmptyState icon={<CalendarClock className="h-10 w-10" />} title="درخواست بازدیدی ثبت نکرده‌اید" desc="در صفحه هر ملک دکمه «درخواست بازدید» را بزنید." />
        ) : (
          <div className="space-y-3">
            {mine.data!.items.map((v) => <VisitCard key={v.id} v={v} />)}
          </div>
        )}
      </section>

      {/* detail dialog with tracking history */}
      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>پیگیری درخواست {detail?.code}</DialogTitle>
            <DialogDescription className="line-clamp-1">{detail?.property.title}</DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-3">
              <div className="rounded-xl bg-muted/60 p-3 text-xs space-y-1.5">
                <div>وضعیت فعلی: <b>{VISIT_STATUS_LABELS[detail.status] ?? detail.status}</b></div>
                {detail.assignedTo && <div>مشاور پیگیری‌کننده: <b>{typeof detail.assignedTo === "string" ? detail.assignedTo : detail.assignedTo.name}</b></div>}
                {detail.adminNote && <div className="text-muted-foreground leading-5">یادداشت: {detail.adminNote}</div>}
              </div>
              <div className="space-y-2">
                <h4 className="text-xs font-black">تاریخچه پیگیری</h4>
                {(detail.events ?? []).map((e, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px]">
                    <span className="rounded-full bg-primary/10 text-primary w-5 h-5 grid place-items-center shrink-0 mt-0.5">{faNum(i + 1)}</span>
                    <div>
                      <div className="font-bold">
                        {e.type === "CREATED" ? "ثبت درخواست" : e.type === "ASSIGN" ? "تخصیص به مشاور" : `تغییر وضعیت به «${VISIT_STATUS_LABELS[e.toStatus ?? ""] ?? e.toStatus}»`}
                        {e.message ? ` — ${e.message}` : ""}
                      </div>
                      <div className="text-muted-foreground">{faDateTime(e.createdAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ───────────────── Messages ─────────────────
function MessagesTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.get<{ items: { id: string; property: { id: string; title: string; image: string | null }; other: { id: string; name: string; phone: string }; lastMessage: { text: string; createdAt: string; senderId: string } | null; lastMessageAt: string }[] }>("/api/messages"),
  });
  if (isLoading) return <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>;
  const items = data?.items ?? [];
  if (!items.length) {
    return <EmptyState icon={<MessagesSquare className="h-10 w-10" />} title="گفت‌وگویی ندارید" desc="با دکمه «ارسال پیام» در صفحه هر ملک، گفت‌وگو را شروع کنید." />;
  }
  return (
    <div className="space-y-3">
      {items.map((c) => (
        <div key={c.id} className="rounded-2xl border bg-card p-4 flex items-center gap-3">
          <span className="w-14 h-14 rounded-lg bg-muted overflow-hidden shrink-0">
            {c.property.image && <img src={c.property.image} alt={c.property.title} className="h-full w-full object-cover" />}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold line-clamp-1">{c.property.title}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{c.other.name}</div>
            {c.lastMessage && <div className="text-xs mt-1 line-clamp-1 text-foreground/80">{c.lastMessage.text}</div>}
          </div>
          <div className="text-left shrink-0">
            <div className="text-[10px] text-muted-foreground">{faDateTime(c.lastMessageAt)}</div>
            <Button size="sm" variant="outline" className="mt-1.5" onClick={() => navigate(`/account/messages/${c.id}`)}>مشاهده گفت‌وگو</Button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ConversationView({ id }: { id: string }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["conversation", id],
    queryFn: () => api.get<{ conversation: { id: string; propertyId: string }; messages: { id: string; text: string; senderId: string; createdAt: string }[] }>(`/api/messages/${id}`),
    refetchInterval: 8000,
  });
  const { me } = useAuth();
  const send = useMutation({
    mutationFn: () => api.post("/api/messages", { conversationId: id, text }),
    onSuccess: () => { setText(""); qc.invalidateQueries({ queryKey: ["conversation", id] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  useSeo({ title: "گفت‌وگو | ویلاسنتو", noIndex: true });

  if (isLoading) return <div className="max-w-2xl mx-auto px-4 py-10"><Skeleton className="h-64 rounded-2xl" /></div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Button variant="ghost" size="sm" className="mb-3" onClick={() => navigate("/account/messages")}>
        <ChevronLeft className="h-4 w-4" /> بازگشت به پیام‌ها
      </Button>
      <div className="rounded-2xl border bg-card divide-y max-h-[60vh] overflow-y-auto scrollbar-thin">
        {(data?.messages ?? []).map((m) => (
          <div key={m.id} className={cn("p-3 text-sm leading-6", m.senderId === me?.id ? "bg-primary/5" : "")}>
            <div className="text-[10px] text-muted-foreground mb-1">{m.senderId === me?.id ? "شما" : "طرف مقابل"} · {faDateTime(m.createdAt)}</div>
            {m.text}
          </div>
        ))}
        {!data?.messages.length && <div className="p-6 text-center text-sm text-muted-foreground">پیامی نیست؛ اولین پیام بفرستید</div>}
      </div>
      <div className="flex gap-2 mt-3">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="پیام…" onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) send.mutate(); }} />
        <Button disabled={!text.trim() || send.isPending} onClick={() => send.mutate()} aria-label="ارسال"><Send className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

// ───────────────── Favorites ─────────────────
export function FavoritesView() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["favorites"],
    queryFn: () => api.get<{ items: import("@/lib/api").PropertyCardT[] }>("/api/favorites"),
  });

  useSeo({ title: "علاقه‌مندی‌ها | ویلاسنتو", noIndex: true });

  const toggleM = useMutation({
    mutationFn: (propertyId: string) => api.post("/api/favorites", { propertyId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favorites"] }),
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="text-xl font-black mb-5">علاقه‌مندی‌های من</h1>
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
        </div>
      ) : (data?.items.length ?? 0) === 0 ? (
        <EmptyState icon={<Heart className="h-12 w-12" />} title="لیست علاقه‌مندی خالی است" desc="با زدن آیکن قلب در صفحه هر ملک آن را اینجا ذخیره کنید." action={<Button asChild><Link to="/search">جستجوی املاک</Link></Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data!.items.map((p) => (
            <div key={p.id} className="relative">
              <PropertyCard p={p} />
              <button
                className="absolute top-2 left-2 z-10 rounded-full bg-black/55 text-white p-1.5 hover:bg-red-600 transition-colors"
                onClick={() => toggleM.mutate(p.id)}
                aria-label="حذف از علاقه‌مندی‌ها"
              >
                <Heart className="h-4 w-4 fill-current" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FavoritesTab() { navigate("/favorites"); return null; }

// ───────────────── Activity ─────────────────
function ActivityTab() {
  const { data } = useQuery({
    queryKey: ["my-activity"],
    queryFn: () => api.get<{ items: { id: string; action: string; entity: string; entityId: string | null; createdAt: string; meta: string | null }[] }>("/api/me/activity"),
  });
  const ACTION_LABELS: Record<string, string> = {
    AUTH_LOGIN: "ورود به حساب", AUTH_LOGIN_PASSWORD: "ورود با رمز عبور", AUTH_OTP_REQUEST: "درخواست کد ورود",
    PASSWORD_SET: "تنظیم رمز عبور", PASSWORD_CHANGE: "تغییر رمز عبور", PASSWORD_RESET: "بازیابی رمز عبور",
    LISTING_SUBMIT: "ارسال آگهی برای تأیید", LISTING_DRAFT: "ذخیره پیش‌نویس آگهی",
    LISTING_UPDATE: "ویرایش آگهی", LISTING_RESUBMIT: "ارسال مجدد آگهی", LISTING_DELETE: "حذف آگهی",
    LISTING_EXTEND: "تمدید آگهی", LISTING_PUBLISHED: "آگهی منتشر شد", LISTING_REJECTED: "آگهی رد شد",
    LISTING_REPORT: "گزارش آگهی", VISIT_REQUEST: "ثبت درخواست بازدید",
    VISIT_STATUS: "به‌روزرسانی درخواست بازدید", FAVORITE_TOGGLE: "تغییر علاقه‌مندی",
    CONTACT_MESSAGE: "ارسال پیام تماس", SETTINGS_UPDATE: "به‌روزرسانی تنظیمات",
  };
  return (
    <div className="rounded-2xl border bg-card divide-y">
      {(data?.items ?? []).length === 0 ? (
        <EmptyState icon={<History className="h-10 w-10" />} title="فعالیتی ثبت نشده" />
      ) : (
        data!.items.map((a) => (
          <div key={a.id} className="p-4 flex items-center justify-between gap-3 text-sm">
            <div>
              <div className="font-bold">{ACTION_LABELS[a.action] ?? a.action}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{a.entity}{a.entityId ? ` · ${a.entityId.slice(-6)}` : ""}</div>
            </div>
            <span className="text-[11px] text-muted-foreground shrink-0">{faDateTime(a.createdAt)}</span>
          </div>
        ))
      )}
    </div>
  );
}

// ───────────────── Profile & security ─────────────────
function ProfileTab({ me }: { me: NonNullable<Me> }) {
  const { setMe } = useAuth();
  const qc = useQueryClient();
  const [fullName, setFullName] = useState(me.fullName ?? "");
  const [email, setEmail] = useState(me.email ?? "");
  const [nationalId, setNationalId] = useState(me.nationalId ?? "");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pw2, setPw2] = useState("");

  const profileM = useMutation({
    mutationFn: () => api.post<{ user: NonNullable<Me> }>("/api/auth/profile", { fullName, email, nationalId }),
    onSuccess: (res) => { setMe(res.user); toast.success("پروفایل به‌روزرسانی شد"); qc.invalidateQueries({ queryKey: ["my-activity"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const setPwM = useMutation({
    mutationFn: (newPassword: string) => api.post("/api/auth/set-password", { newPassword }),
    onSuccess: () => { toast.success("رمز عبور تنظیم شد؛ از این پس می‌توانید با رمز وارد شوید"); setCurrentPw(""); setNewPw(""); setPw2(""); qc.invalidateQueries({ queryKey: ["me"] }); window.location.reload(); },
    onError: (e) => toast.error((e as Error).message),
  });

  const changePwM = useMutation({
    mutationFn: () => api.post("/api/auth/change-password", { currentPassword: currentPw, newPassword: newPw }),
    onSuccess: () => { toast.success("رمز عبور تغییر کرد"); setCurrentPw(""); setNewPw(""); setPw2(""); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="grid md:grid-cols-2 gap-5">
      <div className="rounded-2xl border bg-card p-5 space-y-4">
        <h3 className="font-black text-sm flex items-center gap-2"><UserRound className="h-4 w-4 text-primary" /> اطلاعات پروفایل</h3>
        <div className="space-y-1.5">
          <Label htmlFor="pf-name">نام و نام خانوادگی</Label>
          <Input id="pf-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-phone">شماره موبایل <span className="text-[10px] text-muted-foreground">(غیرقابل تغییر — شناسه حساب)</span></Label>
          <Input id="pf-phone" value={faNum(me.phone)} disabled dir="ltr" className="text-left" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-email">ایمیل</Label>
          <Input id="pf-email" type="email" dir="ltr" className="text-left" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-nid">کد ملی</Label>
          <Input id="pf-nid" inputMode="numeric" dir="ltr" className="text-left" value={nationalId} onChange={(e) => setNationalId(e.target.value.replace(/\D/g, "").slice(0, 10))} />
        </div>
        <Button disabled={profileM.isPending} onClick={() => profileM.mutate()}>
          {profileM.isPending && <Loader2 className="h-4 w-4 animate-spin" />} ذخیره تغییرات
        </Button>
      </div>

      <div className="rounded-2xl border bg-card p-5 space-y-4">
        <h3 className="font-black text-sm flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" /> امنیت — رمز عبور</h3>
        {me.hasPassword ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="cur-pw">رمز عبور فعلی</Label>
              <Input id="cur-pw" type="password" dir="ltr" className="text-left" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-pw1">رمز عبور جدید</Label>
              <Input id="new-pw1" type="password" dir="ltr" className="text-left" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-pw2">تکرار رمز جدید</Label>
              <Input id="new-pw2" type="password" dir="ltr" className="text-left" value={pw2} onChange={(e) => setPw2(e.target.value)} />
            </div>
            <Button
              disabled={changePwM.isPending || !currentPw || newPw.length < 6 || newPw !== pw2}
              onClick={() => changePwM.mutate()}
            >
              {changePwM.isPending && <Loader2 className="h-4 w-4 animate-spin" />} تغییر رمز عبور
            </Button>
            {newPw !== pw2 && <p className="text-xs text-red-600">تکرار رمز با رمز جدید یکسان نیست</p>}
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground leading-6 bg-muted/60 rounded-xl p-3">
              هنوز رمز عبوری برای حساب شما تنظیم نشده است. با تنظیم رمز می‌توانید علاوه بر کد پیامکی، با رمز عبور وارد شوید.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="set-pw">رمز عبور جدید (حداقل ۶ نویسه)</Label>
              <Input id="set-pw" type="password" dir="ltr" className="text-left" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
            </div>
            <Button disabled={setPwM.isPending || newPw.length < 6} onClick={() => setPwM.mutate(newPw)}>
              {setPwM.isPending && <Loader2 className="h-4 w-4 animate-spin" />} تنظیم رمز عبور
            </Button>
          </>
        )}
        <div className="text-[11px] text-muted-foreground leading-5 rounded-xl border p-3 flex items-start gap-2">
          <Smartphone className="h-4 w-4 shrink-0 mt-0.5" />
          ورود دومرحله‌ای پیامکی (OTP) برای همه حساب‌ها فعال است؛ شماره موبایل شما شناسه اصلی حساب است.
        </div>
      </div>
    </div>
  );
}
