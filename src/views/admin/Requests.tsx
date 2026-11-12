"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type VisitT } from "@/lib/api";
import { faNum, faDateTime, VISIT_STATUS_LABELS, VISIT_STATUS_COLORS } from "@/lib/fa";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Phone } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EmptyStateInline } from "./Listings";

type AgentOption = { id: string; fullName: string | null };

export function RequestsSection() {
  return (
    <Tabs defaultValue="visits" dir="rtl">
      <TabsList className="flex-wrap h-auto gap-1 bg-transparent p-0">
        <TabsTrigger value="visits" className="rounded-lg border text-xs font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">درخواست‌های بازدید</TabsTrigger>
        <TabsTrigger value="messages" className="rounded-lg border text-xs font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">پیام‌های تماس</TabsTrigger>
        <TabsTrigger value="reports" className="rounded-lg border text-xs font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">گزارش آگهی و پشتیبانی</TabsTrigger>
      </TabsList>
      <TabsContent value="visits" className="mt-4"><VisitsAdmin /></TabsContent>
      <TabsContent value="messages" className="mt-4"><MessagesAdmin /></TabsContent>
      <TabsContent value="reports" className="mt-4"><ReportsAdmin /></TabsContent>
    </Tabs>
  );
}

// ───────── Visits ─────────
function VisitsAdmin() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("ALL");
  const [detail, setDetail] = useState<(VisitT & { events?: { type: string; toStatus: string | null; message: string | null; createdAt: string }[] }) | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-visits", status],
    queryFn: () => api.get<{ items: (VisitT & { user?: { fullName: string | null; phone: string } | null; assignedTo?: { id: string; fullName: string | null } | null; events?: { type: string; toStatus: string | null; message: string | null; createdAt: string }[] })[] }>(`/api/admin/visits?status=${status}`),
  });
  const { data: agents } = useQuery({
    queryKey: ["admin-agents-lite"],
    queryFn: () => api.get<{ items: AgentOption[] }>("/api/admin/agents"),
  });

  const act = useMutation({
    mutationFn: (p: { id: string; data: Record<string, unknown> }) => api.post("/api/admin/visits", { action: "update", ...p }),
    onSuccess: () => { toast.success("به‌روزرسانی شد"); qc.invalidateQueries({ queryKey: ["admin-visits"] }); setDetail(null); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center rounded-2xl border bg-card p-3">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger size="sm" className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">همه وضعیت‌ها</SelectItem>
            {Object.entries(VISIT_STATUS_LABELS).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
        <a href="/api/admin/export?entity=visits" className="text-xs font-bold text-primary hover:underline">خروجی CSV درخواست‌ها</a>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      ) : (data?.items.length ?? 0) === 0 ? (
        <EmptyStateInline title="درخواستی یافت نشد" />
      ) : (
        <div className="space-y-3">
          {data!.items.map((v) => (
            <div key={v.id} className="rounded-2xl border bg-card p-4 flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={cn("border text-[10px]", VISIT_STATUS_COLORS[v.status])}>{VISIT_STATUS_LABELS[v.status] ?? v.status}</Badge>
                  <span className="text-[10px] text-muted-foreground">{v.code}</span>
                  <span className="text-[10px] text-muted-foreground">{faDateTime(v.createdAt)}</span>
                </div>
                <div className="text-xs font-bold mt-1.5 line-clamp-1">{v.property.title}</div>
                <div className="text-[11px] text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                  <span>متقاضی: {v.name} · {faNum(v.phone)}</span>
                  {v.preferredAt && <span>زمان پیشنهادی: {faDateTime(v.preferredAt)}</span>}
                  <span>مشاور: {v.assignedTo?.fullName ?? "تخصیص نیافته"}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 shrink-0">
                <Select
                  value={v.assignedTo?.id ?? "none"}
                  onValueChange={(val) => act.mutate({ id: v.id, data: { assignedToId: val === "none" ? null : val } })}
                >
                  <SelectTrigger size="sm" className="w-40 text-[11px] h-8" aria-label="تخصیص مشاور"><SelectValue placeholder="تخصیص مشاور" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون تخصیص</SelectItem>
                    {(agents?.items ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.fullName}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={v.status} onValueChange={(val) => act.mutate({ id: v.id, data: { status: val } })}>
                  <SelectTrigger size="sm" className="w-32 text-[11px] h-8" aria-label="تغییر وضعیت"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(VISIT_STATUS_LABELS).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="ghost" onClick={() => setDetail(v)}>تاریخچه</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>پیگیری درخواست {detail?.code}</DialogTitle>
            <DialogDescription className="line-clamp-1">{detail?.property.title}</DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-xs">
              <div className="rounded-xl bg-muted/60 p-3 space-y-1">
                <div>متقاضی: <b>{detail.name}</b> · <span dir="ltr">{faNum(detail.phone)}</span></div>
                {detail.note && <div className="text-muted-foreground leading-5">توضیح متقاضی: {detail.note}</div>}
              </div>
              <div className="space-y-2">
                <h4 className="font-black">تاریخچه پیگیری</h4>
                {(detail.events ?? []).map((e, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="rounded-full bg-primary/10 text-primary w-5 h-5 grid place-items-center shrink-0">{faNum(i + 1)}</span>
                    <div>
                      <div className="font-bold">
                        {e.type === "CREATED" ? "ثبت درخواست" : e.type === "ASSIGN" ? "تخصیص مشاور" : `تغییر وضعیت به «${VISIT_STATUS_LABELS[e.toStatus ?? ""] ?? e.toStatus}»`}
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

// ───────── Contact messages ─────────
type ContactMsg = {
  id: string; name: string; phone: string; email: string | null; subject: string | null;
  body: string; status: string; adminNote: string | null;
  property?: { title: string; code: string } | null; createdAt: string;
};

function MessagesAdmin() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("ALL");
  const [edit, setEdit] = useState<ContactMsg | null>(null);
  const [adminNote, setAdminNote] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-messages", status],
    queryFn: () => api.get<{ items: ContactMsg[] }>(`/api/admin/messages?status=${status}`),
  });

  const act = useMutation({
    mutationFn: (p: { id: string; data: Record<string, unknown> }) => api.post("/api/admin/messages", { action: "update", ...p }),
    onSuccess: () => { toast.success("به‌روزرسانی شد"); qc.invalidateQueries({ queryKey: ["admin-messages"] }); setEdit(null); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border bg-card p-3">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger size="sm" className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">همه وضعیت‌ها</SelectItem>
            {Object.entries(VISIT_STATUS_LABELS).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {isLoading ? (
        <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
      ) : (data?.items.length ?? 0) === 0 ? (
        <EmptyStateInline title="پیامی یافت نشد" />
      ) : (
        <div className="space-y-3">
          {data!.items.map((m) => (
            <div key={m.id} className="rounded-2xl border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={cn("border text-[10px]", VISIT_STATUS_COLORS[m.status])}>{VISIT_STATUS_LABELS[m.status] ?? m.status}</Badge>
                <span className="text-xs font-bold">{m.name}</span>
                <a href={`tel:${m.phone}`} className="text-[11px] text-primary flex items-center gap-1" dir="ltr"><Phone className="h-3 w-3" /> {faNum(m.phone)}</a>
                {m.property && <span className="text-[10px] text-muted-foreground">درباره: {m.property.title}</span>}
                <span className="text-[10px] text-muted-foreground mr-auto">{faDateTime(m.createdAt)}</span>
              </div>
              {m.subject && <div className="text-xs font-bold mt-2">{m.subject}</div>}
              <p className="text-xs text-muted-foreground leading-6 mt-1">{m.body}</p>
              {m.adminNote && <p className="text-[11px] rounded-lg bg-muted px-2.5 py-1.5 mt-2">یادداشت: {m.adminNote}</p>}
              <div className="flex flex-wrap gap-1.5 mt-3">
                <Select value={m.status} onValueChange={(val) => act.mutate({ id: m.id, data: { status: val } })}>
                  <SelectTrigger size="sm" className="w-32 text-[11px] h-8" aria-label="تغییر وضعیت پیام"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(VISIT_STATUS_LABELS).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={() => { setEdit(m); setAdminNote(m.adminNote ?? ""); }}>یادداشت مدیر</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader><DialogTitle>یادداشت مدیریتی</DialogTitle><DialogDescription>فقط برای مدیران قابل مشاهده است</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <Textarea rows={3} value={adminNote} onChange={(e) => setAdminNote(e.target.value)} />
            <Button className="w-full" disabled={act.isPending} onClick={() => edit && act.mutate({ id: edit.id, data: { adminNote } })}>ذخیره یادداشت</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ───────── Reports (listing reports + support) ─────────
type ComplaintT = {
  id: string; type: string; subject: string; body: string; status: string; adminReply: string | null;
  user?: { fullName: string | null; phone: string } | null;
  property?: { id: string; title: string; code: string } | null;
  createdAt: string;
};

function ReportsAdmin() {
  const qc = useQueryClient();
  const [type, setType] = useState("ALL");
  const [replyTo, setReplyTo] = useState<ComplaintT | null>(null);
  const [reply, setReply] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-complaints", type],
    queryFn: () => api.get<{ items: ComplaintT[] }>(`/api/admin/complaints?type=${type}`),
  });

  const act = useMutation({
    mutationFn: (p: { id: string; reply: string; status: string }) => api.post("/api/admin/complaints", { action: "reply", ...p }),
    onSuccess: () => { toast.success("ثبت شد"); qc.invalidateQueries({ queryKey: ["admin-complaints"] }); setReplyTo(null); setReply(""); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border bg-card p-3">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger size="sm" className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">همه</SelectItem>
            <SelectItem value="LISTING_REPORT">گزارش آگهی نامعتبر</SelectItem>
            <SelectItem value="SUPPORT">پشتیبانی</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {isLoading ? (
        <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
      ) : (data?.items.length ?? 0) === 0 ? (
        <EmptyStateInline title="گزارشی یافت نشد" />
      ) : (
        <div className="space-y-3">
          {data!.items.map((c) => (
            <div key={c.id} className="rounded-2xl border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={cn("border text-[10px]", c.status === "RESOLVED" ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-amber-100 text-amber-800 border-amber-200")}>
                  {c.status === "RESOLVED" ? "حل‌شده" : c.status === "IN_PROGRESS" ? "در حال پیگیری" : "باز"}
                </Badge>
                <Badge variant="outline" className="text-[10px]">{c.type === "LISTING_REPORT" ? "گزارش آگهی" : "پشتیبانی"}</Badge>
                {c.property && <span className="text-[10px] text-muted-foreground">آگهی: {c.property.title} ({c.property.code})</span>}
                <span className="text-[10px] text-muted-foreground mr-auto">{faDateTime(c.createdAt)}</span>
              </div>
              <div className="text-xs font-bold mt-2">{c.subject}</div>
              <p className="text-xs text-muted-foreground leading-6 mt-1">{c.body}</p>
              {c.adminReply && <p className="text-[11px] rounded-lg bg-muted px-2.5 py-1.5 mt-2">پاسخ مدیر: {c.adminReply}</p>}
              <div className="flex flex-wrap gap-1.5 mt-3">
                <Button size="sm" variant="outline" onClick={() => { setReplyTo(c); setReply(c.adminReply ?? ""); }}>پاسخ و بستن</Button>
                {c.status !== "IN_PROGRESS" && c.status !== "RESOLVED" && (
                  <Button size="sm" variant="ghost" onClick={() => act.mutate({ id: c.id, reply: c.adminReply ?? "", status: "IN_PROGRESS" })}>در حال پیگیری</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!replyTo} onOpenChange={(v) => !v && setReplyTo(null)}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader><DialogTitle>پاسخ به گزارش</DialogTitle><DialogDescription className="line-clamp-1">{replyTo?.subject}</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <Textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="پاسخ/توضیح مدیریتی…" />
            <Button className="w-full" disabled={act.isPending} onClick={() => replyTo && act.mutate({ id: replyTo.id, reply, status: "RESOLVED" })}>ثبت پاسخ و حل</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
