"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Link } from "@/lib/router";
import { faNum, faDateTime, shortMoney, TRANSACTION_TYPE_LABELS, LISTING_STATUS_LABELS, LISTING_STATUS_COLORS } from "@/lib/fa";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Star, Trash2, Eye, Send, Archive, Ban, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type AdminListing = {
  id: string; code: string; title: string; transactionType: string;
  status: string; rejectionReason: string | null;
  city: string; province: string;
  host: { id: string; fullName: string | null; phone: string; isHostVerified: boolean };
  agent: { id: string; fullName: string } | null;
  salePrice: number | null; rahnAmount: number | null; rentAmount: number | null;
  image: string | null; viewCount: number; isFeatured: boolean;
  visitsCount: number; favoritesCount: number;
  publishedAt: string | null; expiresAt: string | null; createdAt: string;
};

export function ListingsSection() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("ALL");
  const [tt, setTt] = useState("ALL");
  const [q, setQ] = useState("");
  const [rejectTarget, setRejectTarget] = useState<AdminListing | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [detail, setDetail] = useState<AdminListing | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-listings", status, tt, q],
    queryFn: () => api.get<{ items: AdminListing[] }>(`/api/admin/properties?status=${status}&tt=${tt}&q=${encodeURIComponent(q)}`),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-listings"] });
    qc.invalidateQueries({ queryKey: ["admin-overview"] });
    qc.invalidateQueries({ queryKey: ["admin-charts"] });
  };

  const act = useMutation({
    mutationFn: (p: { action: string; id: string; reason?: string; featured?: boolean; to?: string }) =>
      api.post("/api/admin/properties", p),
    onSuccess: () => { toast.success("عملیات انجام شد"); invalidate(); setRejectTarget(null); setRejectReason(""); setDetail(null); },
    onError: (e) => toast.error((e as Error).message),
  });

  const nextStatusOptions: Record<string, { to: string; label: string }[]> = {
    PENDING: [{ to: "PUBLISHED", label: "تأیید و انتشار" }, { to: "APPROVED", label: "تأیید بدون انتشار" }, { to: "REJECTED", label: "رد آگهی" }],
    APPROVED: [{ to: "PUBLISHED", label: "انتشار" }, { to: "REJECTED", label: "رد" }, { to: "ARCHIVED", label: "بایگانی" }],
    PUBLISHED: [{ to: "APPROVED", label: "لغو انتشار" }, { to: "ARCHIVED", label: "بایگانی" }],
    REJECTED: [{ to: "PENDING", label: "بازگشت به بررسی" }, { to: "ARCHIVED", label: "بایگانی" }],
    EXPIRED: [{ to: "PUBLISHED", label: "انتشار مجدد" }, { to: "ARCHIVED", label: "بایگانی" }],
    ARCHIVED: [{ to: "PUBLISHED", label: "انتشار" }, { to: "PENDING", label: "ارسال به بررسی" }],
    DRAFT: [],
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center rounded-2xl border bg-card p-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pr-9" placeholder="جستجوی عنوان / کد آگهی…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger size="sm" className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">همه وضعیت‌ها</SelectItem>
            {Object.entries(LISTING_STATUS_LABELS).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={tt} onValueChange={setTt}>
          <SelectTrigger size="sm" className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">همه معامله‌ها</SelectItem>
            {Object.entries(TRANSACTION_TYPE_LABELS).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{data ? `${faNum(data.items.length)} نتیجه` : ""}</span>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      ) : (data?.items.length ?? 0) === 0 ? (
        <EmptyStateInline title="آگهی‌ای با این فیلترها یافت نشد" />
      ) : (
        <div className="space-y-3">
          {data!.items.map((l) => (
            <div key={l.id} className="rounded-2xl border bg-card p-4 flex flex-col md:flex-row md:items-center gap-4">
              <span className="w-full md:w-24 h-20 rounded-xl bg-muted overflow-hidden shrink-0">
                {l.image ? <img src={l.image} alt={l.title} className="h-full w-full object-cover" /> : <span className="grid place-items-center h-full text-xs text-muted-foreground">—</span>}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={cn("border text-[10px]", LISTING_STATUS_COLORS[l.status])}>{LISTING_STATUS_LABELS[l.status] ?? l.status}</Badge>
                  <span className="text-[10px] text-muted-foreground">{l.code}</span>
                  <span className="text-[10px] text-muted-foreground">· {TRANSACTION_TYPE_LABELS[l.transactionType]}</span>
                  {l.isFeatured && <Badge className="bg-amber-500 text-white border-amber-500 text-[10px]">ویژه</Badge>}
                </div>
                <Link to={`/property/${l.id}`} className="font-bold text-sm mt-1.5 line-clamp-1 hover:text-primary block">{l.title}</Link>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground mt-1.5">
                  <span>{l.province}، {l.city}</span>
                  <span>ثبت‌کننده: {l.host.fullName ?? l.host.phone} {l.host.isHostVerified && "✓"}</span>
                  {l.agent && <span className="flex items-center gap-1"><UserCheck className="h-3 w-3" /> مشاور: {l.agent.fullName}</span>}
                  <span>{faNum(l.viewCount)} بازدید</span>
                  <span className="font-bold text-primary">{shortMoney(l.salePrice ?? l.rahnAmount ?? l.rentAmount ?? 0)}</span>
                  <span>ثبت: {faDateTime(l.createdAt)}</span>
                </div>
                {l.status === "REJECTED" && l.rejectionReason && (
                  <p className="text-[11px] text-red-600 mt-1.5">دلیل رد: {l.rejectionReason}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 shrink-0">
                {(nextStatusOptions[l.status] ?? []).map((o) => (
                  <Button
                    key={o.to}
                    size="sm"
                    variant={o.to === "PUBLISHED" ? "default" : o.to === "REJECTED" ? "destructive" : "outline"}
                    onClick={() => {
                      if (o.to === "REJECTED") setRejectTarget(l);
                      else act.mutate({ action: "set-status", id: l.id, to: o.to });
                    }}
                  >
                    {o.to === "REJECTED" ? <Ban className="h-3.5 w-3.5" /> : o.to === "PUBLISHED" ? <Send className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                    {o.label}
                  </Button>
                ))}
                <Button size="sm" variant={l.isFeatured ? "secondary" : "outline"} onClick={() => act.mutate({ action: "toggle-featured", id: l.id })} aria-label="ویژه کردن">
                  <Star className={cn("h-3.5 w-3.5", l.isFeatured && "fill-amber-500 text-amber-500")} />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDetail(l)} aria-label="جزئیات"><Eye className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => { if (window.confirm("حذف قطعی آگهی؟")) act.mutate({ action: "delete", id: l.id }); }} aria-label="حذف">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!rejectTarget} onOpenChange={(v) => !v && setRejectTarget(null)}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>رد آگهی</DialogTitle>
            <DialogDescription className="line-clamp-1">{rejectTarget?.title}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="دلیل رد (برای نمایش به ثبت‌کننده)…" />
            <Button
              className="w-full" variant="destructive"
              disabled={!rejectReason.trim() || act.isPending}
              onClick={() => rejectTarget && act.mutate({ action: "reject", id: rejectTarget.id, reason: rejectReason })}
            >
              ثبت رد آگهی
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="line-clamp-2">{detail?.title}</DialogTitle>
            <DialogDescription>کد: {detail?.code}</DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="text-sm space-y-2.5">
              <Row label="وضعیت" value={LISTING_STATUS_LABELS[detail.status] ?? detail.status} />
              <Row label="نوع معامله" value={TRANSACTION_TYPE_LABELS[detail.transactionType]} />
              <Row label="قیمت" value={shortMoney(detail.salePrice ?? detail.rahnAmount ?? detail.rentAmount ?? 0)} />
              <Row label="موقعیت" value={`${detail.province}، ${detail.city}`} />
              <Row label="ثبت‌کننده" value={`${detail.host.fullName ?? "—"} (${faNum(detail.host.phone)})`} />
              <Row label="مشاور" value={detail.agent?.fullName ?? "تخصیص نیافته"} />
              <Row label="بازدید / علاقه‌مندی" value={`${faNum(detail.viewCount)} / ${faNum(detail.favoritesCount)}`} />
              <Row label="انتشار" value={detail.publishedAt ? faDateTime(detail.publishedAt) : "—"} />
              <Row label="انقضا" value={detail.expiresAt ? faDateTime(detail.expiresAt) : "—"} />
              <Link to={`/property/${detail.id}`} className="text-xs text-primary hover:underline inline-block">مشاهده صفحه آگهی</Link>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

export function EmptyStateInline({ title }: { title: string }) {
  return <div className="rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground">{title}</div>;
}
