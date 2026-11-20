"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type RegionNodeT } from "@/lib/api";
import { faNum } from "@/lib/fa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/site/misc";
import { toast } from "sonner";
import { MapPin, PlusCircle, Search, Loader2, Pencil, Trash2, AlertTriangle, ShieldCheck, Star } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  PROVINCE: "استان", COUNTY: "شهرستان", DEHESTAN: "دهستان", CITY: "شهر",
  ROAD: "محور / جاده", VILLAGE: "روستا", AREA: "محدوده / محله",
};

type AdminRegionsResponse = { tree: RegionNodeT[] };

/**
 * پنل مدیریت مناطق — مشاهده/جستجو/افزودن/ویرایش/غیرفعال‌سازی مناطق
 * (اعتبارسنجی سمت سرور: جلوگیری از تکرار، حلقه سلسله‌مراتب و مختصات ناقص)
 */
export function RegionsSection() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<RegionNodeT | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<RegionNodeT | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-regions", q],
    queryFn: () => api.get<AdminRegionsResponse>(`/api/admin/regions?q=${encodeURIComponent(q)}`),
  });

  const flat = useMemo(() => {
    const out: RegionNodeT[] = [];
    const walk = (nodes: RegionNodeT[]) => nodes.forEach((n) => { out.push(n); walk(n.children); });
    walk(data?.tree ?? []);
    return out;
  }, [data]);

  const toggleActive = async (r: RegionNodeT) => {
    try {
      await api.post("/api/admin/regions", { action: "toggle-active", id: r.id });
      toast.success(r.isActive ? `«${r.name}» غیرفعال شد` : `«${r.name}» فعال شد`);
      qc.invalidateQueries({ queryKey: ["admin-regions"] });
      qc.invalidateQueries({ queryKey: ["regions-tree"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    try {
      await api.post("/api/admin/regions", { action: "delete", id: deleting.id });
      toast.success(`«${deleting.name}» حذف شد`);
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["admin-regions"] });
      qc.invalidateQueries({ queryKey: ["regions-tree"] });
    } catch (e) {
      toast.error((e as Error).message);
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-56 max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pr-9" placeholder="جستجوی نام، شناسه لاتین یا نام جایگزین…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="جستجوی مناطق" />
        </div>
        <Button onClick={() => setCreating(true)}>
          <PlusCircle className="h-4 w-4" /> افزودن منطقه جدید
        </Button>
      </div>

      <p className="text-xs text-muted-foreground bg-muted/60 rounded-xl p-3 leading-5">
        مختصات فقط برای موقعیت‌های تأییدشده ثبت می‌شود؛ مناطق بدون موقعیت قطعی با برچسب «نیازمند بررسی» نمایش داده می‌شوند
        و روی نقشه و صفحات سئو به‌عنوان موقعیت قطعی معرفی نمی‌شوند.
      </p>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3, 4].map((i) => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : flat.length === 0 ? (
        <EmptyState icon={<MapPin className="h-12 w-12" />} title="منطقه‌ای یافت نشد" desc="عبارت جستجو را تغییر دهید یا منطقه جدیدی بسازید." />
      ) : (
        <div className="rounded-2xl border bg-card divide-y">
          {flat.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-bold">{r.name}</span>
                  <span className="text-[10px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground font-bold">{TYPE_LABELS[r.type] ?? r.type}</span>
                  {r.isFeatured && <span className="text-[10px] rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 flex items-center gap-0.5 font-bold"><Star className="h-2.5 w-2.5" /> اصلی</span>}
                  {r.geoStatus === "VERIFIED" ? (
                    <span className="text-[10px] rounded-full bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 flex items-center gap-0.5 font-bold"><ShieldCheck className="h-2.5 w-2.5" /> موقعیت تأییدشده</span>
                  ) : (
                    <span className="text-[10px] rounded-full bg-amber-50 text-amber-800 border border-amber-300 px-2 py-0.5 flex items-center gap-0.5 font-bold"><AlertTriangle className="h-2.5 w-2.5" /> نیازمند بررسی</span>
                  )}
                  {!r.isActive && <span className="text-[10px] rounded-full bg-muted text-muted-foreground px-2 py-0.5 font-bold">غیرفعال</span>}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                  <span dir="ltr">{r.nameEn}</span>
                  {r.path && <span>{r.path}</span>}
                  <span>{faNum(r.count)} آگهی مستقیم · {faNum(r.totalCount)} با زیرمجموعه‌ها</span>
                  {r.lat != null && <span dir="ltr">📍 {r.lat.toFixed(5)}, {r.lng?.toFixed(5)}</span>}
                  {r.altNames && <span>نام‌های جایگزین: {r.altNames.split("|").join("، ")}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button size="sm" variant="outline" onClick={() => setEditing(r)} aria-label={`ویرایش ${r.name}`}>
                  <Pencil className="h-3.5 w-3.5" /> ویرایش
                </Button>
                <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
                  <Switch checked={r.isActive} onCheckedChange={() => toggleActive(r)} aria-label={`فعال/غیرفعال ${r.name}`} />
                </label>
                <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => setDeleting(r)} aria-label={`حذف ${r.name}`}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <RegionEditDialog
        open={creating || !!editing}
        region={editing}
        flat={flat}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSaved={() => { setCreating(false); setEditing(null); qc.invalidateQueries({ queryKey: ["admin-regions"] }); qc.invalidateQueries({ queryKey: ["regions-tree"] }); }}
      />

      <AlertDialog open={!!deleting} onOpenChange={(v) => { if (!v) setDeleting(null); }}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف منطقه «{deleting?.name}»</AlertDialogTitle>
            <AlertDialogDescription>
              حذف فقط وقتی ممکن است که منطقه زیرمجموعه یا آگهی متصل نداشته باشد؛ در غیر این صورت می‌توانید آن را غیرفعال کنید. این عملیات بازگشت‌پذیر نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={doDelete}>حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RegionEditDialog({ open, region, flat, onClose, onSaved }: {
  open: boolean;
  region: RegionNodeT | null;
  flat: RegionNodeT[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!region;
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(() => shape(region));

  // re-shape when the target region changes
  const key = region?.id ?? "new";
  const [lastKey, setLastKey] = useState("");
  if (open && key !== lastKey) {
    setLastKey(key);
    setForm(shape(region));
  }

  const parents = flat.filter((r) => r.id !== region?.id);

  const save = async () => {
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        altNames: form.altNames,
        type: form.type,
        parentId: form.parentId || null,
        lat: form.lat === "" ? null : Number(form.lat),
        lng: form.lng === "" ? null : Number(form.lng),
        geoStatus: form.geoStatus,
        isActive: form.isActive,
        isFeatured: form.isFeatured,
        sort: Number(form.sort) || 0,
        description: form.description,
      };
      if (isEdit) {
        await api.post("/api/admin/regions", { action: "upsert", id: region!.id, data: payload });
        toast.success("تغییرات منطقه ذخیره شد");
      } else {
        if (!form.nameEn.trim()) throw new Error("شناسه لاتین (nameEn) الزامی است");
        payload.nameEn = form.nameEn.trim();
        await api.post("/api/admin/regions", { action: "upsert", data: payload });
        toast.success("منطقه جدید ثبت شد");
      }
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{isEdit ? `ویرایش منطقه «${region?.name}»` : "افزودن منطقه جدید"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>نام فارسی *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثلاً رضویه" />
            </div>
            <div className="space-y-1.5">
              <Label>نوع منطقه *</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {!isEdit && (
            <div className="space-y-1.5">
              <Label>شناسه لاتین (nameEn) *</Label>
              <Input dir="ltr" className="text-left" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} placeholder="مثلاً razaviyeh" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>نام‌های جایگزین</Label>
            <Input value={form.altNames} onChange={(e) => setForm({ ...form, altNames: e.target.value })} placeholder="با | جدا کنید؛ مثلاً قلعه سیاه|رضویه قلعه سیاه" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>طول جغرافیایی (Lng)</Label>
              <Input dir="ltr" className="text-left" inputMode="decimal" value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} placeholder="59.41141" />
            </div>
            <div className="space-y-1.5">
              <Label>عرض جغرافیایی (Lat)</Label>
              <Input dir="ltr" className="text-left" inputMode="decimal" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} placeholder="36.48341" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>وضعیت تأیید موقعیت</Label>
              <Select value={form.geoStatus} onValueChange={(v) => setForm({ ...form, geoStatus: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="VERIFIED">تأییدشده</SelectItem>
                  <SelectItem value="UNVERIFIED">نیازمند بررسی</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>منطقه مادر</Label>
              <Select value={form.parentId || "root"} onValueChange={(v) => setForm({ ...form, parentId: v === "root" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-56">
                  <SelectItem value="root">بدون مادر (ریشه)</SelectItem>
                  {parents.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} — {TYPE_LABELS[p.type] ?? p.type}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>توضیحات</Label>
            <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="مثلاً منبع مختصات یا نکات جغرافیایی" />
          </div>
          <div className="grid grid-cols-3 gap-3 items-center">
            <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} aria-label="فعال" /> فعال
            </label>
            <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
              <Switch checked={form.isFeatured} onCheckedChange={(v) => setForm({ ...form, isFeatured: v })} aria-label="منطقه اصلی" /> منطقه اصلی
            </label>
            <div className="space-y-1.5">
              <Label>ترتیب</Label>
              <Input dir="ltr" className="text-left h-8" inputMode="numeric" value={form.sort} onChange={(e) => setForm({ ...form, sort: e.target.value.replace(/\D/g, "") })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>انصراف</Button>
          <Button onClick={save} disabled={busy || !form.name.trim()}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} ذخیره
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function shape(r: RegionNodeT | null) {
  return {
    name: r?.name ?? "",
    nameEn: r?.nameEn ?? "",
    altNames: r?.altNames ?? "",
    type: r?.type ?? "VILLAGE",
    parentId: r?.parentId ?? "",
    lat: r?.lat != null ? String(r.lat) : "",
    lng: r?.lng != null ? String(r.lng) : "",
    geoStatus: r?.geoStatus ?? "UNVERIFIED",
    isActive: r?.isActive ?? true,
    isFeatured: r?.isFeatured ?? false,
    sort: String(r?.sort ?? 0),
    description: r?.description ?? "",
  };
}
