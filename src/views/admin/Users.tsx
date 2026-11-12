"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { faNum, faDateTime, ROLE_LABELS, LISTING_STATUS_LABELS } from "@/lib/fa";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Ban, Eye, UserRound } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EmptyStateInline } from "./Listings";

type AdminUser = {
  id: string; phone: string; fullName: string | null; email: string | null;
  role: string; roleLabel: string; isBlocked: boolean; isHostVerified: boolean;
  hasPassword: boolean; propertiesCount: number; favoritesCount: number; visitsCount: number;
  agencyName: string | null; createdAt: string;
};

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "bg-violet-100 text-violet-800 border-violet-200",
  ADMIN: "bg-emerald-100 text-emerald-800 border-emerald-200",
  AGENT: "bg-teal-100 text-teal-800 border-teal-200",
  OWNER: "bg-amber-100 text-amber-800 border-amber-200",
  CUSTOMER: "bg-stone-100 text-stone-700 border-stone-200",
};

export function UsersSection() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [role, setRole] = useState("ALL");
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", q, role],
    queryFn: () => api.get<{ items: AdminUser[]; total: number }>(`/api/admin/users?q=${encodeURIComponent(q)}&role=${role}`),
  });

  const act = useMutation({
    mutationFn: (p: { action: string; id: string; role?: string }) => api.post("/api/admin/users", p),
    onSuccess: () => { toast.success("انجام شد"); qc.invalidateQueries({ queryKey: ["admin-users"] }); qc.invalidateQueries({ queryKey: ["admin-user"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const { data: detail } = useQuery({
    queryKey: ["admin-user", detailId],
    queryFn: () => api.get<{
      user: AdminUser & { lastLoginAt: string | null; properties: { id: string; title: string; status: string; code: string }[] };
      activity: { id: string; action: string; createdAt: string }[];
    }>(`/api/admin/user?id=${detailId}`),
    enabled: !!detailId,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center rounded-2xl border bg-card p-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pr-9" placeholder="جستجوی نام / شماره موبایل…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger size="sm" className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">همه نقش‌ها</SelectItem>
            {Object.entries(ROLE_LABELS).filter(([k]) => k !== "HOST").map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
        <a href="/api/admin/export?entity=users" className="text-xs font-bold text-primary hover:underline">خروجی CSV کاربران</a>
      </div>

      <div className="rounded-2xl border bg-card overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
              <th className="p-3 text-right font-bold">کاربر</th>
              <th className="p-3 text-right font-bold">نقش</th>
              <th className="p-3 text-right font-bold">آگهی‌ها</th>
              <th className="p-3 text-right font-bold">عضویت</th>
              <th className="p-3 text-right font-bold">وضعیت</th>
              <th className="p-3 text-right font-bold">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={6} className="p-4"><Skeleton className="h-24 rounded-xl" /></td></tr>
            ) : (data?.items.length ?? 0) === 0 ? (
              <tr><td colSpan={6}><EmptyStateInline title="کاربری یافت نشد" /></td></tr>
            ) : (
              data!.items.map((u) => (
                <tr key={u.id} className={cn(u.isBlocked && "opacity-60")}>
                  <td className="p-3">
                    <div className="font-bold text-xs">{u.fullName ?? "بدون نام"}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5" dir="ltr">{faNum(u.phone)}</div>
                    {u.email && <div className="text-[10px] text-muted-foreground mt-0.5" dir="ltr">{u.email}</div>}
                  </td>
                  <td className="p-3">
                    <Select value={u.role} onValueChange={(v) => { if (v !== u.role && window.confirm(`نقش کاربر به «${ROLE_LABELS[v]}» تغییر کند؟`)) act.mutate({ action: "set-role", id: u.id, role: v }); }}>
                      <SelectTrigger size="sm" className={cn("w-32 text-[11px] h-8", ROLE_COLORS[u.role])} aria-label="تغییر نقش">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ROLE_LABELS).filter(([k]) => k !== "HOST").map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3 text-xs">{faNum(u.propertiesCount)}</td>
                  <td className="p-3 text-[11px] text-muted-foreground">{faDateTime(u.createdAt)}</td>
                  <td className="p-3">
                    {u.isBlocked ? <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">مسدود</Badge> : <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">فعال</Badge>}
                    {u.hasPassword && <div className="text-[9px] text-muted-foreground mt-1">دارای رمز عبور</div>}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => setDetailId(u.id)} aria-label="جزئیات"><Eye className="h-3.5 w-3.5" /></Button>
                      {!["ADMIN", "SUPER_ADMIN"].includes(u.role) && (
                        <Button
                          size="sm" variant={u.isBlocked ? "secondary" : "outline"}
                          onClick={() => act.mutate({ action: "toggle-block", id: u.id })}
                          aria-label={u.isBlocked ? "فعال‌سازی" : "مسدودسازی"}
                        >
                          <Ban className="h-3.5 w-3.5" /> {u.isBlocked ? "رفع مسدودی" : "مسدود"}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!detailId} onOpenChange={(v) => !v && setDetailId(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserRound className="h-4 w-4" /> {detail?.user.fullName ?? "کاربر"}</DialogTitle>
            <DialogDescription dir="ltr">{detail?.user.phone ? faNum(detail.user.phone) : ""}</DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Info label="نقش" value={detail.user.roleLabel} />
                <Info label="وضعیت" value={detail.user.isBlocked ? "مسدود" : "فعال"} />
                <Info label="آگهی‌ها" value={faNum(detail.user.propertiesCount)} />
                <Info label="علاقه‌مندی‌ها" value={faNum(detail.user.favoritesCount)} />
                <Info label="درخواست بازدید" value={faNum(detail.user.visitsCount)} />
                <Info label="عضویت" value={faDateTime(detail.user.createdAt)} />
                {detail.user.agencyName && <Info label="آژانس" value={detail.user.agencyName} />}
              </div>
              <div>
                <h4 className="font-black text-xs mb-2">آگهی‌های کاربر</h4>
                {detail.user.properties.length === 0 ? <p className="text-xs text-muted-foreground">آگهی ندارد</p> : (
                  <div className="space-y-1.5">
                    {detail.user.properties.map((p) => (
                      <div key={p.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-xs">
                        <span className="font-bold line-clamp-1">{p.title}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{LISTING_STATUS_LABELS[p.status] ?? p.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h4 className="font-black text-xs mb-2">فعالیت‌های اخیر</h4>
                <div className="space-y-1">
                  {detail.activity.slice(0, 12).map((a) => (
                    <div key={a.id} className="flex justify-between text-[11px] text-muted-foreground">
                      <span className="font-bold text-foreground/80">{a.action}</span>
                      <span>{faDateTime(a.createdAt)}</span>
                    </div>
                  ))}
                  {detail.activity.length === 0 && <p className="text-xs text-muted-foreground">فعالیتی ثبت نشده</p>}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="font-bold mt-0.5">{value}</div>
    </div>
  );
}
