"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, uploadImage, uploadVideo, deleteUpload, type Lookups, type PropertyDetailT, type RegionsTree, type RegionNodeT } from "@/lib/api";
import { Link, navigate } from "@/lib/router";
import { useAuth } from "@/lib/store";
import { useSeo } from "@/lib/seo";
import { faNum, currentJalaliYear, BRAND, TRANSACTION_TYPE_LABELS, PROPERTY_TYPE_LABELS, DOCUMENT_STATUS_LABELS, CONTACT_PREF_LABELS, priceLine, shortMoney } from "@/lib/fa";
import { MapView } from "@/components/site/MapView";
import { RegionCombobox, type RegionOption } from "@/components/site/RegionCombobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/site/misc";
import { toast } from "sonner";
import {
  ChevronLeft, ChevronRight, Check, Save, Send, Loader2, ImagePlus,
  Star, Trash2, GripVertical, MapPin, CheckCircle2,
  Film, UploadCloud, RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["اطلاعات پایه", "مشخصات ملک", "اطلاعات مالی", "موقعیت مکانی", "تصاویر و رسانه", "تماس و ثبت"];

type FormState = {
  title: string; type: string; transactionType: string; description: string;
  landArea: string; buildArea: string; bedrooms: string; bathrooms: string;
  floors: string; buildYear: string; documentStatus: string; amenities: string[]; amenitiesExtra: string;
  salePrice: string; rahnAmount: string; rentAmount: string; negotiable: boolean; paymentTerms: string;
  provinceId: string; countyId: string; cityId: string; areaId: string;
  regionId: string; regionName: string; regionSlug: string; regionLat: number | null; regionLng: number | null;
  address: string; lat: number | null; lng: number | null;
  images: string[]; mainImage: number; videoUrl: string; videoPosterUrl: string; tourUrl: string;
  contactName: string; contactPhone: string; contactPreference: string;
};

const initialForm: FormState = {
  title: "", type: "VILLA", transactionType: "SALE", description: "",
  landArea: "", buildArea: "", bedrooms: "2", bathrooms: "1", floors: "1",
  buildYear: "", documentStatus: "MALIKI", amenities: [], amenitiesExtra: "",
  salePrice: "", rahnAmount: "", rentAmount: "", negotiable: false, paymentTerms: "",
  provinceId: "", countyId: "", cityId: "", areaId: "",
  regionId: "", regionName: "", regionSlug: "", regionLat: null, regionLng: null,
  address: "", lat: null, lng: null,
  images: [], mainImage: 0, videoUrl: "", videoPosterUrl: "", tourUrl: "",
  contactName: "", contactPhone: "", contactPreference: "BOTH",
};

export function ListingForm({ editId }: { editId?: string }) {
  const { me, loading, openAuth } = useAuth();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initialForm);
  const [busy, setBusy] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [videoPct, setVideoPct] = useState<number | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState<number | null>(null);

  useSeo({ title: editId ? "ویرایش آگهی | ویلاسنتو" : `ثبت آگهی ملک | ${BRAND}`, path: "/new-listing", noIndex: true });

  const { data: lookups } = useQuery({
    queryKey: ["lookups"],
    queryFn: () => api.get<Lookups>("/api/lookups"),
    staleTime: 10 * 60 * 1000,
  });

  // real region tree from the database (hierarchical location picker)
  const { data: regionsData } = useQuery({
    queryKey: ["regions-tree"],
    queryFn: () => api.get<RegionsTree>("/api/regions"),
    staleTime: 10 * 60 * 1000,
  });
  const regionProvinces = (regionsData?.tree ?? []).filter((r) => r.type === "PROVINCE");
  const regionProvince = regionProvinces.find((p) => p.id === form.provinceId) ?? regionProvinces[0];
  const regionCounties = (regionProvince?.children ?? []).filter((r) => r.type === "COUNTY");
  const regionCounty = regionCounties.find((c) => c.id === form.countyId) ?? regionCounties[0];

  // ── region picker helpers (flat index over the real tree) ──
  const flatRegions = useMemo(() => {
    const flat: RegionNodeT[] = [];
    const walk = (nodes: RegionNodeT[]) => nodes.forEach((n) => { flat.push(n); walk(n.children); });
    walk(regionsData?.tree ?? []);
    return flat;
  }, [regionsData]);

  const nodeToOption = (r: RegionNodeT): RegionOption => ({
    id: r.id, name: r.name, nameEn: r.nameEn, typeLabel: r.typeLabel, path: r.path,
    lat: r.lat, lng: r.lng, geoStatus: r.geoStatus, legacyCityId: r.legacyCityId,
  });

  const regionNode = flatRegions.find((r) => r.id === form.regionId) ?? null;
  const regionSel: RegionOption | null = regionNode
    ? nodeToOption(regionNode)
    : form.regionId
      ? { id: form.regionId, name: form.regionName, nameEn: form.regionSlug, typeLabel: "", path: "", lat: form.regionLat, lng: form.regionLng, geoStatus: "VERIFIED" }
      : null;
  const regionSubs = regionNode?.children ?? [];

  const pickRegion = (r: RegionOption | null) => {
    if (!r) {
      setForm((f) => ({ ...f, regionId: "", regionName: "", regionSlug: "", regionLat: null, regionLng: null, areaId: "" }));
      return;
    }
    const node = flatRegions.find((x) => x.id === r.id);
    if (node) {
      const provinceNode = node.provinceId ? flatRegions.find((x) => x.id === node.provinceId) : null;
      const parentNode = node.parentId ? flatRegions.find((x) => x.id === node.parentId) : null;
      const countyNode = node.type === "COUNTY" ? node : (parentNode && parentNode.type === "COUNTY" ? parentNode : null);
      setForm((f) => ({
        ...f,
        regionId: r.id, regionName: r.name, regionSlug: r.nameEn, regionLat: r.lat, regionLng: r.lng,
        provinceId: provinceNode?.id ?? f.provinceId,
        countyId: countyNode?.id ?? f.countyId,
        // legacy city link keeps the old city filters matching this listing
        cityId: r.legacyCityId ?? f.cityId,
        areaId: "",
      }));
    } else {
      setForm((f) => ({ ...f, regionId: r.id, regionName: r.name, regionSlug: r.nameEn, regionLat: r.lat, regionLng: r.lng, cityId: r.legacyCityId ?? f.cityId, areaId: "" }));
    }
  };

  // load existing listing for edit
  useQuery({
    queryKey: ["property-edit", editId],
    queryFn: () => api.get<PropertyDetailT>(`/api/properties/${editId}`),
    enabled: !!editId,
  });

  useEffect(() => {
    if (!editId || draftLoaded) return;
    let cancelled = false;
    api.get<PropertyDetailT>(`/api/properties/${editId}`).then((p) => {
      if (cancelled) return;
      const province = lookups?.provinces.find((x) => x.cities.some((c) => c.name === p.city));
      const city = province?.cities.find((c) => c.name === p.city);
      setForm((f) => ({
        ...f,
        title: p.title, type: p.type, transactionType: p.transactionType, description: p.description,
        landArea: p.landArea?.toString() ?? "", buildArea: p.buildArea?.toString() ?? "",
        bedrooms: String(p.bedrooms), bathrooms: String(p.bathrooms), floors: String(p.floors),
        buildYear: p.buildYear?.toString() ?? "", documentStatus: p.documentStatus,
        amenities: p.allAmenities.map((a) => a.key), amenitiesExtra: p.amenitiesExtra.join("، "),
        salePrice: p.salePrice?.toString() ?? "", rahnAmount: p.rahnAmount?.toString() ?? "", rentAmount: p.rentAmount?.toString() ?? "",
        negotiable: p.negotiable, paymentTerms: p.paymentTerms ?? "",
        provinceId: province?.id ?? "", cityId: city?.id ?? "",
        regionId: p.region?.id ?? "", regionName: p.region?.name ?? "", regionSlug: p.region?.nameEn ?? "",
        regionLat: p.region?.lat ?? null, regionLng: p.region?.lng ?? null,
        address: p.address ?? "",
        lat: p.lat, lng: p.lng, images: p.images, mainImage: 0,
        videoUrl: p.videoUrl ?? "", videoPosterUrl: (p as PropertyDetailT & { videoPosterUrl?: string | null }).videoPosterUrl ?? "", tourUrl: p.tourUrl ?? "",
        contactName: p.owner.name, contactPhone: "", contactPreference: p.contactPreference ?? "BOTH",
      }));
      setDraftLoaded(true);
    }).catch(() => setDraftLoaded(true));
    return () => { cancelled = true; };
     
  }, [editId, lookups]);

  // auth guard
  useEffect(() => {
    if (!loading && !me) openAuth("برای ثبت آگهی ابتدا وارد حساب شوید");
  }, [loading, me, openAuth]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const tt = form.transactionType;
  const province = lookups?.provinces.find((p) => p.id === form.provinceId);
  const city = province?.cities.find((c) => c.id === form.cityId);

  const canNext = useMemo(() => {
    switch (step) {
      case 0: return form.title.trim().length >= 3 && !!form.type && !!form.transactionType;
      case 1: return true;
      case 2:
        if (tt === "SALE") return !!form.salePrice;
        if (tt === "RAHN") return !!form.rahnAmount;
        if (tt === "RAHN_RENT") return !!form.rahnAmount && !!form.rentAmount;
        if (tt === "RENT") return !!form.rentAmount;
        return true;
      case 3: return !!form.regionId || !!form.cityId;
      case 4: return form.images.length > 0;
      case 5: return !!form.contactPhone || !!me?.phone;
      default: return true;
    }
  }, [step, form, tt, me]);

  const persist = async (submit: boolean) => {
    setBusy(true);
    try {
      const payload = {
        title: form.title.trim(),
        type: form.type,
        transactionType: form.transactionType,
        description: form.description.trim(),
        regionId: form.regionId || undefined,
        cityId: form.cityId || undefined,
        areaId: form.areaId || undefined,
        address: form.address,
        lat: form.lat ?? undefined,
        lng: form.lng ?? undefined,
        landArea: form.landArea ? Number(form.landArea) : undefined,
        buildArea: form.buildArea ? Number(form.buildArea) : undefined,
        bedrooms: form.bedrooms ? Number(form.bedrooms) : 0,
        bathrooms: form.bathrooms ? Number(form.bathrooms) : 1,
        floors: form.floors ? Number(form.floors) : 1,
        buildYear: form.buildYear ? Number(form.buildYear) : undefined,
        documentStatus: form.documentStatus,
        amenitiesExtra: form.amenitiesExtra,
        salePrice: form.salePrice ? Number(form.salePrice) : undefined,
        rahnAmount: form.rahnAmount ? Number(form.rahnAmount) : undefined,
        rentAmount: form.rentAmount ? Number(form.rentAmount) : undefined,
        negotiable: form.negotiable,
        paymentTerms: form.paymentTerms || undefined,
        videoUrl: form.videoUrl || undefined,
        videoPosterUrl: form.videoPosterUrl || undefined,
        tourUrl: form.tourUrl || undefined,
        contactName: form.contactName || undefined,
        contactPhone: form.contactPhone || me?.phone,
        contactPreference: form.contactPreference,
        images: form.images,
        amenityKeys: form.amenities,
        submit,
      };
      if (editId) {
        await api.patch(`/api/properties/${editId}`, payload);
        toast.success(submit ? "آگهی برای بررسی مجدد ارسال شد" : "تغییرات ذخیره شد");
      } else if (submit) {
        await api.post("/api/properties", payload);
        toast.success("آگهی ثبت شد و پس از تأیید کارشناسان منتشر می‌شود", { duration: 6000 });
      } else {
        await api.post("/api/properties", payload);
        toast.success("پیش‌نویس آگهی ذخیره شد؛ از پنل کاربری می‌توانید ادامه دهید");
      }
      qc.invalidateQueries({ queryKey: ["my-listings"] });
      navigate("/account/listings");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const maxMB = 5;
    for (const f of Array.from(files).slice(0, 12 - form.images.length)) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
        toast.error(`«${f.name}»: فرمت باید JPG، PNG یا WebP باشد`);
        continue;
      }
      if (f.size > maxMB * 1024 * 1024) {
        toast.error(`«${f.name}»: حجم بیش از ${faNum(maxMB)} مگابایت`);
        continue;
      }
      try {
        setUploadPct(1);
        const res = await uploadImage(f, (pct) => setUploadPct(Math.max(1, pct)), "listings");
        setForm((fr) => ({ ...fr, images: [...fr.images, res.url] }));
        toast.success(`«${f.name}» آپلود شد`);
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setUploadPct(null);
      }
    }
  };


  // ── video: pick → local preview + poster capture → upload with progress ──
  const videoMaxMB = (lookups as (Lookups & { uploadLimits?: { videoMaxMB: number } }) | undefined)?.uploadLimits?.videoMaxMB ?? 50;

  const capturePoster = (file: File): Promise<string | null> =>
    new Promise((resolve) => {
      try {
        const url = URL.createObjectURL(file);
        const v = document.createElement("video");
        v.preload = "metadata"; v.muted = true;
        v.src = url;
        const cleanup = () => URL.revokeObjectURL(url);
        v.onloadeddata = () => { v.currentTime = Math.min(1, (v.duration || 2) / 3); };
        v.onseeked = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = v.videoWidth; canvas.height = v.videoHeight;
            canvas.getContext("2d")?.drawImage(v, 0, 0);
            canvas.toBlob(async (blob) => {
              cleanup();
              if (!blob) return resolve(null);
              try {
                const res = await uploadImage(new File([blob], "poster.webp", { type: "image/webp" }), undefined, "posters");
                resolve(res.url);
              } catch { resolve(null); }
            }, "image/webp", 0.8);
          } catch { cleanup(); resolve(null); }
        };
        v.onerror = () => { cleanup(); resolve(null); };
      } catch { resolve(null); }
    });

  const uploadVideoFile = async (file: File) => {
    setVideoError(null); setVideoPct(1);
    try {
      const poster = await capturePoster(file);
      if (poster) set("videoPosterUrl", poster);
      const res = await uploadVideo(file, (pct) => setVideoPct(Math.max(1, pct)), "videos");
      setForm((fr) => ({ ...fr, videoUrl: res.url }));
      setVideoPct(null); setVideoFile(null);
      toast.success("ویدیو با موفقیت بارگذاری شد");
    } catch (e) {
      setVideoPct(null);
      setVideoError((e as Error).message || "آپلود ویدیو ناموفق بود");
    }
  };

  const handleVideoFile = (files: FileList | null) => {
    setVideoError(null);
    const f = files?.[0];
    if (!f) return;
    if (!["video/mp4", "video/webm"].includes(f.type) && !f.name.match(/\.(mp4|webm)$/i)) {
      toast.error("فرمت ویدیو باید MP4 یا WebM باشد");
      return;
    }
    if (f.size > videoMaxMB * 1024 * 1024) {
      toast.error(`حجم ویدیو باید کمتر از ${faNum(videoMaxMB)} مگابایت باشد`);
      return;
    }
    setVideoFile(f);
    void uploadVideoFile(f);
  };

  const removeVideo = async () => {
    const url = form.videoUrl;
    setForm((f) => ({ ...f, videoUrl: "", videoPosterUrl: "" }));
    if (url && url.startsWith("/api/files/")) {
      try { await deleteUpload(url); } catch { /* file may already be gone */ }
    }
    toast.success("ویدیو حذف شد");
  };

  if (!loading && !me) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <EmptyState icon={<Save className="h-12 w-12" />} title="ورود لازم است" desc="برای ثبت آگهی ابتدا وارد حساب کاربری شوید." action={<Button onClick={() => openAuth("برای ثبت آگهی وارد حساب شوید")}>ورود / ثبت‌نام</Button>} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-black">{editId ? "ویرایش آگهی" : "ثبت آگهی ملک"}</h1>
        <p className="text-xs text-muted-foreground mt-1.5 leading-5">
          آگهی پس از ثبت، توسط کارشناسان {BRAND} بررسی و حداکثر ظرف ۲۴ ساعت منتشر می‌شود. اعتبار هر آگهی {faNum(60)} روز است.
        </p>
      </div>

      {/* stepper */}
      <ol className="flex items-center gap-1 overflow-x-auto pb-2 mb-6 text-[11px]" aria-label="مراحل ثبت آگهی">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => i <= step && setStep(i)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 font-bold transition-colors",
                i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                i <= step ? "cursor-pointer" : "cursor-default"
              )}
              aria-current={i === step ? "step" : undefined}
            >
              <span className={cn("rounded-full w-5 h-5 grid place-items-center text-[10px]", i === step ? "bg-primary-foreground/20" : i < step ? "bg-primary/20" : "bg-background")}>
                {i < step ? <Check className="h-3 w-3" /> : faNum(i + 1)}
              </span>
              {s}
            </button>
            {i < STEPS.length - 1 && <span className="w-3 h-px bg-border" />}
          </li>
        ))}
      </ol>

      <div className="rounded-2xl border bg-card p-5 md:p-7">
        {/* STEP 0 — base */}
        {step === 0 && (
          <div className="space-y-4">
            <Field label="عنوان آگهی" required hint="حداقل ۸ نویسه؛ مثلاً «باغ‌ویلای ۵۰۰ متری لواسان با استخر»">
              <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="عنوان جذاب و دقیق بنویسید" maxLength={120} />
            </Field>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="نوع ملک" required>
                <Select value={form.type} onValueChange={(v) => set("type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PROPERTY_TYPE_LABELS).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="نوع معامله" required>
                <Select value={form.transactionType} onValueChange={(v) => set("transactionType", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TRANSACTION_TYPE_LABELS).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="توضیحات کامل" required hint="حداقل ۳۰ نویسه — موقعیت، دسترسی، مشخصات ساخت و ویژگی‌های متمایز را بنویسید">
              <Textarea rows={7} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="توضیحات واقعی و دقیق شانس انتشار و بازدید آگهی را چند برابر می‌کند…" />
            </Field>
          </div>
        )}

        {/* STEP 1 — specs */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="متراژ زمین (متر مربع)">
                <Input inputMode="numeric" dir="ltr" className="text-left" value={form.landArea} onChange={(e) => set("landArea", digits(e.target.value))} />
              </Field>
              <Field label="متراژ زیربنا (متر مربع)">
                <Input inputMode="numeric" dir="ltr" className="text-left" value={form.buildArea} onChange={(e) => set("buildArea", digits(e.target.value))} />
              </Field>
              <Field label="اتاق خواب">
                <Input inputMode="numeric" dir="ltr" className="text-left" value={form.bedrooms} onChange={(e) => set("bedrooms", digits(e.target.value))} />
              </Field>
              <Field label="سرویس بهداشتی">
                <Input inputMode="numeric" dir="ltr" className="text-left" value={form.bathrooms} onChange={(e) => set("bathrooms", digits(e.target.value))} />
              </Field>
              <Field label="تعداد طبقات">
                <Input inputMode="numeric" dir="ltr" className="text-left" value={form.floors} onChange={(e) => set("floors", digits(e.target.value))} />
              </Field>
              <Field label="سال ساخت (شمسی)">
                <Select value={form.buildYear || "none"} onValueChange={(v) => set("buildYear", v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="انتخاب سال" /></SelectTrigger>
                  <SelectContent className="max-h-56">
                    <SelectItem value="none">نامشخص / نوساز</SelectItem>
                    {Array.from({ length: 40 }, (_, i) => currentJalaliYear() - i).map((y) => (
                      <SelectItem key={y} value={String(y)}>{faNum(y)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="وضعیت سند">
              <Select value={form.documentStatus} onValueChange={(v) => set("documentStatus", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DOCUMENT_STATUS_LABELS).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="امکانات و ویژگی‌ها">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                {lookups?.amenities.map((a) => (
                  <label key={a.key} className="flex items-center gap-1.5 text-xs rounded-lg border p-2.5 cursor-pointer hover:border-primary/40">
                    <Checkbox
                      checked={form.amenities.includes(a.key)}
                      onCheckedChange={(v) => set("amenities", v ? [...form.amenities, a.key] : form.amenities.filter((x) => x !== a.key))}
                      aria-label={a.name}
                    />
                    {a.name}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="امکانات متنی دیگر" hint="با ویرگول جدا کنید؛ مثلاً: برق سه‌فاز، گرمایش از کف">
              <Input value={form.amenitiesExtra} onChange={(e) => set("amenitiesExtra", e.target.value)} />
            </Field>
          </div>
        )}

        {/* STEP 2 — financial */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground bg-muted/60 rounded-xl p-3 leading-5">
              فیلدهای مالی متناسب با نوع معامله «{TRANSACTION_TYPE_LABELS[tt]}» نمایش داده می‌شوند. مبالغ به تومان است.
            </p>
            {tt === "SALE" && (
              <Field label="قیمت فروش کل (تومان)" required>
                <Input inputMode="numeric" dir="ltr" className="text-left font-bold" value={faNum(form.salePrice)} onChange={(e) => set("salePrice", digits(e.target.value))} />
                {form.salePrice && <p className="text-xs text-primary font-bold mt-1">{priceLine("SALE", Number(form.salePrice))}</p>}
              </Field>
            )}
            {(tt === "RAHN" || tt === "RAHN_RENT") && (
              <Field label="مبلغ رهن (ودیعه) — تومان" required>
                <Input inputMode="numeric" dir="ltr" className="text-left font-bold" value={faNum(form.rahnAmount)} onChange={(e) => set("rahnAmount", digits(e.target.value))} />
                {form.rahnAmount && <p className="text-xs text-primary font-bold mt-1">{shortMoney(Number(form.rahnAmount))}</p>}
              </Field>
            )}
            {(tt === "RENT" || tt === "RAHN_RENT") && (
              <Field label="اجاره ماهانه — تومان" required={tt === "RENT"}>
                <Input inputMode="numeric" dir="ltr" className="text-left font-bold" value={faNum(form.rentAmount)} onChange={(e) => set("rentAmount", digits(e.target.value))} />
                {form.rentAmount && <p className="text-xs text-primary font-bold mt-1">{shortMoney(Number(form.rentAmount))} در ماه</p>}
              </Field>
            )}
            <label className="flex items-center gap-2 cursor-pointer rounded-xl border p-3.5">
              <Checkbox checked={form.negotiable} onCheckedChange={(v) => set("negotiable", !!v)} aria-label="امکان توافق" />
              <span className="text-sm font-bold">قیمت قابل توافق است</span>
            </label>
            <Field label="شرایط پرداخت" hint="مثلاً: حداقل ۴۰٪ نقد، مابقی تا ۶ ماه">
              <Input value={form.paymentTerms} onChange={(e) => set("paymentTerms", e.target.value)} />
            </Field>
          </div>
        )}

        {/* STEP 3 — location (hierarchical region system, real DB data) */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="استان" required>
                <Select
                  value={regionProvince?.id || "all"}
                  onValueChange={(v) => setForm((f) => ({ ...f, provinceId: v, countyId: "", cityId: "", regionId: "", regionName: "", regionSlug: "", regionLat: null, regionLng: null }))}
                >
                  <SelectTrigger><SelectValue placeholder="انتخاب استان" /></SelectTrigger>
                  <SelectContent>
                    {regionProvinces.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="شهرستان" required>
                <Select
                  value={regionCounty?.id || "all"}
                  onValueChange={(v) => setForm((f) => ({ ...f, countyId: v, regionId: "", regionName: "", regionSlug: "", regionLat: null, regionLng: null }))}
                  disabled={!regionProvince}
                >
                  <SelectTrigger><SelectValue placeholder={regionProvince ? "انتخاب شهرستان" : "ابتدا استان"} /></SelectTrigger>
                  <SelectContent>
                    {regionCounties.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field label="منطقه / محدوده" required hint="نام را تایپ کنید — نام‌های جایگزین هم جستجو می‌شود (مثلاً «قلعه سیاه» برای رضویه یا «سنتو» برای جاده سنتو)">
              <RegionCombobox
                value={regionSel}
                onChange={pickRegion}
                placeholder="مثلاً رضویه، ناظریه، چهارفصل، جاده سنتو…"
              />
              {regionSel && (
                <p className="text-[11px] text-muted-foreground mt-1.5">محدوده انتخابی: {regionSel.path || regionSel.name}</p>
              )}
            </Field>

            {regionSubs.length > 0 && (
              <Field label="روستا / زیرمجموعه" hint={`زیرمجموعه‌های «${regionSel?.name}» — انتخاب یکی به‌عنوان محدوده دقیق‌تر`}>
                <Select
                  value={form.regionId || "self"}
                  onValueChange={(v) => {
                    if (v === "self") return;
                    const child = regionSubs.find((r) => r.id === v);
                    if (child) pickRegion(nodeToOption(child));
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-56">
                    <SelectItem value="self">همه {regionSel?.name}</SelectItem>
                    {regionSubs.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                        {r.geoStatus === "UNVERIFIED" && <span className="text-[9px] text-amber-700 bg-amber-100 rounded px-1 mr-1">نیازمند بررسی</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            <Field label="آدرس دقیق">
              <Input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="نشانی کامل ملک" />
            </Field>
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <Label className="text-sm font-bold flex items-center gap-1.5"><MapPin className="h-4 w-4 text-primary" /> انتخاب موقعیت روی نقشه</Label>
                {regionSel && regionSel.lat != null && regionSel.lng != null && (
                  <Button
                    type="button" size="sm" variant="outline" className="h-7 text-[11px]"
                    onClick={() => { set("lat", regionSel.lat); set("lng", regionSel.lng); toast.info("موقعیت تقریبی منطقه اعمال شد؛ برای دقت بیشتر نشانگر را روی نقشه جابه‌جا کنید"); }}
                  >
                    استفاده از موقعیت تقریبی «{regionSel.name}»
                  </Button>
                )}
              </div>
              <MapView
                picker
                picked={form.lat != null && form.lng != null ? { lat: form.lat, lng: form.lng } : null}
                onPick={(pos) => setForm((f) => ({ ...f, lat: pos.lat, lng: pos.lng }))}
                height={340}
                center={form.lat && form.lng ? [form.lat, form.lng] : undefined}
                focus={form.regionLat != null && form.regionLng != null ? { lat: form.regionLat, lng: form.regionLng, zoom: 14 } : null}
                enableRegionSearch={false}
              />
              {form.lat != null && form.lng != null ? (
                <p className="text-xs text-muted-foreground mt-2">
                  مختصات: <b dir="ltr">{form.lat.toFixed(5)}, {form.lng.toFixed(5)}</b>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-2">موقعیت تقریبی روی نقشه کافی است — نمایش روی نقشه شانس تماس را بالا می‌برد.</p>
              )}
            </div>
          </div>
        )}

        {/* STEP 4 — media */}
        {step === 4 && (
          <div className="space-y-4">
            <div
              className="rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
              role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter") fileRef.current?.click(); }}
              aria-label="بارگذاری تصاویر"
            >
              <ImagePlus className="h-10 w-10 mx-auto text-primary/60" />
              <p className="font-bold text-sm mt-3">تصاویر ملک را بارگذاری کنید</p>
              <p className="text-xs text-muted-foreground mt-1.5 leading-5">
                JPG، PNG یا WebP · حداکثر {faNum(5)} مگابایت هر تصویر · حداکثر {faNum(12)} تصویر
                <br />اولین تصویر به‌عنوان کاور آگهی استفاده می‌شود
              </p>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
            </div>

            {uploadPct != null && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground"><span>در حال آپلود…</span><span>{faNum(uploadPct)}٪</span></div>
                <Progress value={uploadPct} />
              </div>
            )}

            {form.images.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {form.images.map((url, i) => (
                  <div key={url} className={cn("relative rounded-xl overflow-hidden border-2 group", i === form.mainImage ? "border-primary" : "border-transparent")}>
                    { }
                    <img src={url} alt={`تصویر ${faNum(i + 1)} از آگهی`} loading="lazy" className="aspect-[4/3] w-full object-cover bg-muted" />
                    {i === form.mainImage && (
                      <Badge className="absolute top-1.5 right-1.5 bg-primary text-primary-foreground text-[10px] gap-1">
                        <Star className="h-3 w-3" /> تصویر اصلی
                      </Badge>
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-black/55 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center justify-center gap-1 p-1.5">
                      <button className="text-white text-[10px] px-1.5 py-1 rounded bg-white/15 hover:bg-white/25" onClick={() => setForm((f) => ({ ...f, mainImage: i, images: [f.images[i], ...f.images.filter((_, j) => j !== i)] }))} aria-label="انتخاب به‌عنوان اصلی">
                        <Star className="h-3.5 w-3.5 inline" /> اصلی
                      </button>
                      {i > 0 && (
                        <button className="text-white text-[10px] px-1.5 py-1 rounded bg-white/15 hover:bg-white/25" onClick={() => setForm((f) => { const imgs = [...f.images]; [imgs[i - 1], imgs[i]] = [imgs[i], imgs[i - 1]]; return { ...f, images: imgs, mainImage: f.mainImage === i ? i - 1 : f.mainImage === i - 1 ? i : f.mainImage }; })} aria-label="انتقال به عقب">
                          <GripVertical className="h-3.5 w-3.5 inline rotate-90" /> جابجایی
                        </button>
                      )}
                      <button className="text-red-300 text-[10px] px-1.5 py-1 rounded bg-white/15 hover:bg-red-500/40" onClick={() => setConfirmDeleteIdx(i)} aria-label="حذف تصویر">
                        <Trash2 className="h-3.5 w-3.5 inline" /> حذف
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-2xl border border-dashed p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold">
                <Film className="h-4 w-4 text-primary" /> ویدیوی ملک (اختیاری — از دستگاه: MP4 یا WebM، حداکثر {faNum(videoMaxMB)} مگابایت)
              </div>

              {form.videoUrl ? (
                <div className="space-y-3">
                  <video
                    src={form.videoUrl}
                    poster={form.videoPosterUrl || undefined}
                    controls
                    preload="metadata"
                    className="w-full max-h-72 rounded-xl bg-black"
                    aria-label="پیش‌نمایش ویدیوی ملک"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => (videoRef.current as HTMLInputElement | null)?.click()} disabled={!!videoPct}>
                      <UploadCloud className="h-4 w-4" /> جایگزینی ویدیو
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={removeVideo}>
                      <Trash2 className="h-4 w-4" /> حذف ویدیو
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="w-full rounded-xl border bg-muted/40 py-6 hover:bg-muted/70 transition-colors"
                  onClick={() => videoRef.current?.click()}
                  role="button" tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter") videoRef.current?.click(); }}
                  aria-label="بارگذاری ویدیو"
                >
                  <UploadCloud className="h-8 w-8 mx-auto text-primary/60" />
                  <p className="text-sm font-bold mt-2">انتخاب ویدیو از دستگاه</p>
                  <p className="text-xs text-muted-foreground mt-1">MP4 یا WebM · یک فایل · تصویر کاور خودکار از فریم ویدیو ساخته می‌شود</p>
                </button>
              )}

              <input
                ref={videoRef} type="file" accept="video/mp4,video/webm" className="hidden"
                onChange={(e) => { handleVideoFile(e.target.files); e.target.value = ""; }}
                aria-hidden="true"
              />

              {videoPct != null && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>در حال بارگذاری ویدیو… {videoFile ? `(${faNum(Math.round(videoFile.size / 1048576))} مگابایت)` : ""}</span>
                    <span>{faNum(videoPct)}٪</span>
                  </div>
                  <Progress value={videoPct} />
                </div>
              )}

              {videoError && (
                <div className="flex items-center justify-between rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                  <span>{videoError}</span>
                  {videoFile && (
                    <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => uploadVideoFile(videoFile)}>
                      <RotateCcw className="h-3 w-3" /> تلاش مجدد
                    </Button>
                  )}
                </div>
              )}

              <Field label="یا لینک خارجی ویدیو (اختیاری)">
                <Input dir="ltr" className="text-left" value={form.videoUrl && !form.videoUrl.startsWith("/api/files/") ? form.videoUrl : ""} onChange={(e) => { set("videoUrl", e.target.value); if (form.videoPosterUrl) set("videoPosterUrl", ""); }} placeholder="https://…" />
              </Field>
            </div>

            <Field label="لینک تور مجازی ۳۶۰° (اختیاری)">
              <Input dir="ltr" className="text-left" value={form.tourUrl} onChange={(e) => set("tourUrl", e.target.value)} placeholder="https://…" />
            </Field>
          </div>
        )}

        {/* STEP 5 — contact + review */}
        {step === 5 && (
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="نام ثبت‌کننده" required>
                <Input value={form.contactName} onChange={(e) => set("contactName", e.target.value)} placeholder={me?.fullName ?? "نام شما"} />
              </Field>
              <Field label="شماره تماس" required>
                <Input inputMode="tel" dir="ltr" className="text-left" value={form.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} placeholder={me?.phone ?? "09xxxxxxxxx"} />
              </Field>
            </div>
            <Field label="روش ارتباطی ترجیحی">
              <Select value={form.contactPreference} onValueChange={(v) => set("contactPreference", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CONTACT_PREF_LABELS).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>

            {/* final review */}
            <div className="rounded-xl bg-muted/50 border p-4 text-sm space-y-2">
              <h3 className="font-black text-xs mb-2">بازبینی نهایی اطلاعات</h3>
              <ReviewRow label="عنوان" value={form.title} />
              <ReviewRow label="نوع" value={`${PROPERTY_TYPE_LABELS[form.type] ?? form.type} · ${TRANSACTION_TYPE_LABELS[tt]}`} />
              <ReviewRow label="موقعیت" value={form.regionName ? `${form.regionName}${form.regionSlug ? ` (منطقه تأییدشده ویلاسنتو)` : ""}` : `${province?.name ?? "—"} / ${city?.name ?? "—"}`} />
              <ReviewRow label="قیمت" value={priceLine(tt, form.salePrice ? Number(form.salePrice) : null, form.rahnAmount ? Number(form.rahnAmount) : null, form.rentAmount ? Number(form.rentAmount) : null)} />
              <ReviewRow label="تصاویر" value={`${faNum(form.images.length)} تصویر`} />
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="outline" disabled={busy} onClick={() => persist(false)}>
                <Save className="h-4 w-4" /> ذخیره پیش‌نویس
              </Button>
              <Button disabled={busy || !canNext} onClick={() => persist(true)}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                ثبت و ارسال برای تأیید
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-teal-600" />
              با ثبت آگهی، صحت اطلاعات و تصاویر را تأیید می‌کنید. آگهی‌های نامعتبر حذف می‌شوند.
            </p>
          </div>
        )}

        {/* nav buttons */}
        <div className="flex items-center justify-between mt-7 pt-5 border-t">
          <Button variant="ghost" disabled={step === 0 || busy} onClick={() => setStep((s) => Math.max(0, s - 1))}>
            <ChevronRight className="h-4 w-4" /> مرحله قبل
          </Button>
          {step < 5 && (
            <Button disabled={!canNext} onClick={() => setStep((s) => Math.min(5, s + 1))}>
              مرحله بعد <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* delete-image confirmation */}
      <AlertDialog open={confirmDeleteIdx != null} onOpenChange={(v) => { if (!v) setConfirmDeleteIdx(null); }}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف تصویر</AlertDialogTitle>
            <AlertDialogDescription>
              این تصویر از آگهی حذف می‌شود. پس از ذخیرهٔ تغییرات، حذف قطعی است. آیا مطمئن هستید؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                const i = confirmDeleteIdx;
                setConfirmDeleteIdx(null);
                if (i == null) return;
                setForm((f) => ({
                  ...f,
                  images: f.images.filter((_, j) => j !== i),
                  mainImage: f.mainImage >= i ? Math.max(0, f.mainImage - (f.mainImage === i ? 1 : 0)) : f.mainImage,
                }));
              }}
            >
              حذف تصویر
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-bold">{label} {required && <span className="text-red-500">*</span>}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground leading-5">{hint}</p>}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="text-muted-foreground shrink-0 w-16">{label}:</span>
      <span className="font-bold leading-5">{value || "—"}</span>
    </div>
  );
}

function digits(s: string): string {
  return s.replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c))).replace(/\D/g, "");
}
