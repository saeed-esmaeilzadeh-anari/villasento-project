"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { faNum, faDateTime } from "@/lib/fa";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { UserPlus, Pencil, Power, Phone, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { EmptyStateInline } from "./Listings";

type AgentRow = {
  id: string; fullName: string | null; phone: string; isBlocked: boolean;
  profile: { agencyName: string | null; bio: string | null; licenseNo: string | null; phone2: string | null; isActive: boolean; photoUrl: string | null } | null;
  assignedCount: number; publishedCount: number; pendingCount: number; visitsDone: number; totalViews: number;
  createdAt: string;
};

export function AgentsSection() {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<{ open: boolean; agent?: AgentRow }>({ open: false });
  const { data, isLoading } = useQuery({
    queryKey: ["admin-agents"],
    queryFn: () => api.get<{ items: AgentRow[] }>("/api/admin/agents"),
  });

  const act = useMutation({
    mutationFn: (p: { action: string; id?: string; data?: unknown }) => api.post("/api/admin/agents", p),
    onSuccess: () => { toast.success("انجام شد"); qc.invalidateQueries({ queryKey: ["admin-agents"] }); setDialog({ open: false }); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-3">
        <p className="text-xs text-muted-foreground">تخصیص آگهی به مشاور از بخش «مدیریت آگهی‌ها» انجام می‌شود.</p>
        <Button size="sm" onClick={() => setDialog({ open: true })}><UserPlus className="h-4 w-4" /> افزودن مشاور</Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      ) : (data?.items.length ?? 0) === 0 ? (
        <EmptyStateInline title="هنوز مشاوری ثبت نشده است" />
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {data!.items.map((a) => (
            <div key={a.id} className="rounded-2xl border bg-card p-4">
              <div className="flex items-start gap-3">
                <span className="w-12 h-12 rounded-full bg-primary/10 text-primary grid place-items-center font-black shrink-0 overflow-hidden">
                  {a.profile?.photoUrl ? <img src={a.profile.photoUrl} alt={a.fullName ?? ""} className="h-full w-full object-cover rounded-full" /> : (a.fullName ?? "?").slice(0, 1)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm flex items-center gap-2 flex-wrap">
                    {a.fullName}
                    {a.profile?.isActive === false
                      ? <Badge className="bg-stone-100 text-stone-600 border-stone-200 text-[10px]">غیرفعال</Badge>
                      : <Badge className="bg-teal-100 text-teal-800 border-teal-200 text-[10px]">فعال</Badge>}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                    <span className="flex items-center gap-1" dir="ltr"><Phone className="h-3 w-3" /> {faNum(a.phone)}</span>
                    {a.profile?.agencyName && <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" /> {a.profile.agencyName}</span>}
                    {a.profile?.licenseNo && <span>پروانه: {a.profile.licenseNo}</span>}
                  </div>
                  {a.profile?.bio && <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2 leading-5">{a.profile.bio}</p>}
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 mt-3 text-center">
                <MiniStat label="آگهی" value={a.assignedCount} />
                <MiniStat label="منتشرشده" value={a.publishedCount} />
                <MiniStat label="بازدید موفق" value={a.visitsDone} />
                <MiniStat label="بازدید کل" value={a.totalViews} />
              </div>
              <div className="flex gap-1.5 mt-3">
                <Button size="sm" variant="outline" onClick={() => setDialog({ open: true, agent: a })}><Pencil className="h-3.5 w-3.5" /> ویرایش</Button>
                <Button size="sm" variant="ghost" onClick={() => act.mutate({ action: "toggle-active", id: a.id })}>
                  <Power className="h-3.5 w-3.5" /> {a.profile?.isActive === false ? "فعال‌سازی" : "غیرفعال‌سازی"}
                </Button>
                <span className="text-[10px] text-muted-foreground self-center mr-auto">{faDateTime(a.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <AgentDialog
        open={dialog.open}
        agent={dialog.agent}
        onClose={() => setDialog({ open: false })}
        onSave={(payload) => act.mutate({ action: "upsert", id: dialog.agent?.id, data: payload })}
        busy={act.isPending}
      />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/60 py-2">
      <div className="text-sm font-black">{faNum(value)}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

function AgentDialog({ open, agent, onClose, onSave, busy }: {
  open: boolean; agent?: AgentRow; onClose: () => void; onSave: (p: Record<string, unknown>) => void; busy: boolean;
}) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [bio, setBio] = useState("");
  const [licenseNo, setLicenseNo] = useState("");
  const [phone2, setPhone2] = useState("");
  const [password, setPassword] = useState("");
  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = agent?.id ?? "new";

  // hydrate fields whenever the dialog target changes
  if (open && lastKey !== key) {
    setLastKey(key);
    setFullName(agent?.fullName ?? "");
    setPhone(agent?.phone ?? "");
    setAgencyName(agent?.profile?.agencyName ?? "");
    setBio(agent?.profile?.bio ?? "");
    setLicenseNo(agent?.profile?.licenseNo ?? "");
    setPhone2(agent?.profile?.phone2 ?? "");
    setPassword("");
  }
  if (!open && lastKey !== null) setLastKey(null);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>{agent ? "ویرایش مشاور" : "افزودن مشاور املاک"}</DialogTitle>
          <DialogDescription>اطلاعات پروانه و تماس مشاور را کامل وارد کنید</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ag-name">نام و نام خانوادگی *</Label>
              <Input id="ag-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ag-phone">موبایل *</Label>
              <Input id="ag-phone" inputMode="tel" dir="ltr" className="text-left" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ag-agency">نام آژانس / املاک</Label>
            <Input id="ag-agency" value={agencyName} onChange={(e) => setAgencyName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ag-license">شماره پروانه</Label>
              <Input id="ag-license" dir="ltr" className="text-left" value={licenseNo} onChange={(e) => setLicenseNo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ag-phone2">تلفن ثابت</Label>
              <Input id="ag-phone2" dir="ltr" className="text-left" value={phone2} onChange={(e) => setPhone2(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ag-bio">معرفی کوتاه</Label>
            <Textarea id="ag-bio" rows={2} value={bio} onChange={(e) => setBio(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ag-pw">{agent ? "رمز جدید (اختیاری)" : "رمز عبور اولیه (اختیاری)"}</Label>
            <Input id="ag-pw" type="password" dir="ltr" className="text-left" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button
            className="w-full" disabled={busy || !fullName.trim() || !phone.trim()}
            onClick={() => onSave({ fullName, phone, agencyName, bio, licenseNo, phone2, ...(password ? { password } : {}) })}
          >
            ذخیره
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
