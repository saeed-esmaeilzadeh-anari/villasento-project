"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type PropertyDetailT, type Lookups } from "@/lib/api";
import { Link, navigate } from "@/lib/router";
import { useAuth, useCompare, useHistory } from "@/lib/store";
import { useSeo, listingJsonLd } from "@/lib/seo";
import { faNum, faDateTime, priceLine, shortMoney, TRANSACTION_TYPE_LABELS, PROPERTY_TYPE_LABELS, DOCUMENT_STATUS_LABELS, CONTACT_PREF_LABELS, REPORT_REASONS, BRAND } from "@/lib/fa";
import { ImageGallery, PropertyStatusBadge } from "@/components/site/misc";
import { MapView } from "@/components/site/MapView";
import { PropertyCard } from "@/components/site/PropertyCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Heart, Share2, Phone, MessageSquare, CalendarClock, Flag, MapPin, Ruler,
  BedDouble, Bath, Building2, TreePine, CalendarDays, Eye, BadgeCheck,
  FileCheck2, Landmark, Star, ChevronLeft, Handshake, UserRound,
} from "lucide-react";

export function PropertyView({ idOverride }: { idOverride?: string }) {
  const id = idOverride ?? (typeof window !== "undefined" ? window.location.hash.split("/")[2]?.split("?")[0] : "");
  const { me, openAuth } = useAuth();
  const qc = useQueryClient();
  const compare = useCompare();
  const pushHistory = useHistory((s) => s.push);

  const [imgOpen, setImgOpen] = useState(false);
  const [visitOpen, setVisitOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const [phoneRevealed, setPhoneRevealed] = useState(false);

  const { data: p, isLoading, error } = useQuery({
    queryKey: ["property", id],
    queryFn: () => api.get<PropertyDetailT>(`/api/properties/${id}`),
    enabled: !!id,
  });

  const { data: lookups } = useQuery({
    queryKey: ["lookups"],
    queryFn: () => api.get<Lookups>("/api/lookups"),
    staleTime: 10 * 60 * 1000,
  });

  // track view (deduped server-side per viewer+day)
  useEffect(() => {
    if (p?.id && p.status === "PUBLISHED") {
      api.post("/api/track", { propertyId: p.id }).catch(() => {});
      pushHistory(p.id);
    }
     
  }, [p?.id]);

  const isOwnerOrAgent = !!me && (me.id === p?.hostId || me.id === p?.agentId);

  useSeo({
    title: p ? `${p.title} | ${BRAND}` : "جزئیات ملک | ویلاسنتو",
    description: p ? `${priceLine(p.transactionType, p.salePrice, p.rahnAmount, p.rentAmount)} — ${p.province}، ${p.city}${p.area ? "، " + p.area : ""} — ${p.buildArea ? faNum(p.buildArea) + " متر بنا، " : ""}${p.landArea ? faNum(p.landArea) + " متر زمین" : ""}` : undefined,
    path: `/property/${id}`,
    image: p?.image ?? null,
    jsonLd: p ? listingJsonLd(p) : null,
    noIndex: p ? p.status !== "PUBLISHED" : false,
  });

  const favoriteMutation = useMutation({
    mutationFn: async () => {
      if (!me) { openAuth("برای افزودن به علاقه‌مندی‌ها وارد حساب شوید"); throw new Error("login"); }
      return api.post<{ favorited: boolean }>("/api/favorites", { propertyId: id });
    },
    onSuccess: (res) => {
      toast.success(res.favorited ? "به علاقه‌مندی‌ها اضافه شد" : "از علاقه‌مندی‌ها حذف شد");
      qc.invalidateQueries({ queryKey: ["property", id] });
    },
    onError: (e) => { if ((e as Error).message !== "login") toast.error((e as Error).message); },
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="h-72 rounded-2xl bg-muted animate-pulse" />
        <div className="mt-4 space-y-3">
          <div className="h-6 w-2/3 rounded bg-muted animate-pulse" />
          <div className="h-4 w-1/3 rounded bg-muted animate-pulse" />
          <div className="h-40 rounded-2xl bg-muted animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !p) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <Landmark className="h-12 w-12 mx-auto text-muted-foreground/50" />
        <h1 className="font-black text-lg mt-4">این آگهی در دسترس نیست</h1>
        <p className="text-sm text-muted-foreground mt-2">ممکن است آگهی حذف شده یا منتشر نشده باشد.</p>
        <Button className="mt-5" asChild><Link to="/search">جستجوی املاک</Link></Button>
      </div>
    );
  }

  const shareUrl = window.location.href;
  const shareText = `${p.title} — ${priceLine(p.transactionType, p.salePrice, p.rahnAmount, p.rentAmount)}`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* breadcrumb + title */}
      <nav className="text-xs text-muted-foreground flex flex-wrap items-center gap-1 mb-3" aria-label="مسیر">
        <Link to="/" className="hover:text-primary">خانه</Link> /
        <Link to="/search" className="hover:text-primary">املاک</Link> /
        <Link to={`/search?types=${p.type}`} className="hover:text-primary">{p.typeLabel}</Link> /
        <span className="text-foreground">{p.city}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border font-bold bg-primary/10 text-primary border-primary/20">{TRANSACTION_TYPE_LABELS[p.transactionType]}</Badge>
            <Badge variant="outline">{p.typeLabel}</Badge>
            {p.isFeatured && <Badge className="bg-amber-500 text-white border-amber-500">⭐ ویژه</Badge>}
            {p.status !== "PUBLISHED" && <PropertyStatusBadge status={p.status} />}
          </div>
          <h1 className="text-xl md:text-2xl font-black mt-2.5 leading-relaxed">{p.title}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {p.province}، {p.city}{p.area ? `، ${p.area}` : ""}</span>
            <span>کد آگهی: <b className="text-foreground font-bold">{p.code}</b></span>
            <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {faNum(p.viewCount)} بازدید</span>
            {p.publishedAt && <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> انتشار: {faDateTime(p.publishedAt)}</span>}
            <span>آخرین به‌روزرسانی: {faDateTime(p.updatedAt)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={p.favorited ? "default" : "outline"}
            size="icon"
            aria-label="افزودن به علاقه‌مندی‌ها"
            onClick={() => favoriteMutation.mutate()}
            disabled={favoriteMutation.isPending}
          >
            <Heart className={p.favorited ? "h-4 w-4 fill-current" : "h-4 w-4"} />
          </Button>
          <Button
            variant={compare.ids.includes(p.id) ? "default" : "outline"}
            size="icon"
            aria-label="افزودن به مقایسه"
            onClick={() => {
              const r = compare.toggle({ id: p.id, title: p.title, image: p.image });
              if (r.added) toast.success("به لیست مقایسه اضافه شد (حداکثر ۴ ملک)");
              else if (compare.ids.includes(p.id)) toast.info("از لیست مقایسه حذف شد");
              else toast.warning("حداکثر ۴ ملک قابل مقایسه است");
            }}
          >
            <Star className={compare.ids.includes(p.id) ? "h-4 w-4 fill-current" : "h-4 w-4"} />
          </Button>
          <Button
            variant="outline" size="icon" aria-label="اشتراک‌گذاری"
            onClick={async () => {
              try {
                if (navigator.share) await navigator.share({ title: p.title, text: shareText, url: shareUrl });
                else { await navigator.clipboard.writeText(shareUrl); toast.success("لینک آگهی کپی شد"); }
              } catch { /* cancelled */ }
            }}
          >
            <Share2 className="h-4 w-4" />
          </Button>
          {!isOwnerOrAgent && (
            <Button variant="outline" size="icon" aria-label="گزارش آگهی نامعتبر" onClick={() => (!me ? openAuth("برای گزارش آگهی وارد حساب شوید") : setReportOpen(true))}>
              <Flag className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* main */}
        <div className="lg:col-span-2 space-y-6 min-w-0">
          {/* gallery */}
          <div
            className="cursor-zoom-in"
            onClick={() => setImgOpen(true)}
            role="button"
            tabIndex={0}
            aria-label="نمایش تمام‌صفحه تصاویر"
            onKeyDown={(e) => { if (e.key === "Enter") setImgOpen(true); }}
          >
            <ImageGallery images={p.images} title={p.title} />
          </div>
          {(p.videoUrl || p.tourUrl) && (
            <div className="flex flex-wrap gap-2">
              {p.videoUrl && (
                <Button variant="outline" size="sm" asChild><a href={p.videoUrl} target="_blank" rel="noopener noreferrer">▶ مشاهده ویدئو ملک</a></Button>
              )}
              {p.tourUrl && (
                <Button variant="outline" size="sm" asChild><a href={p.tourUrl} target="_blank" rel="noopener noreferrer">👁 تور مجازی ۳۶۰°</a></Button>
              )}
            </div>
          )}

          {/* price card */}
          <div className="rounded-2xl border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs text-muted-foreground mb-1">
                  {p.transactionType === "SALE" ? "قیمت فروش" : p.transactionType === "RAHN" ? "مبلغ رهن (ودیعه)" : p.transactionType === "RAHN_RENT" ? "رهن و اجاره ماهانه" : "اجاره ماهانه"}
                </div>
                <div className="text-xl md:text-2xl font-black text-primary leading-9">{priceLine(p.transactionType, p.salePrice, p.rahnAmount, p.rentAmount)}</div>
              </div>
              {p.negotiable && (
                <Badge variant="outline" className="gap-1 border-teal-300 text-teal-700"><Handshake className="h-3.5 w-3.5" /> امکان توافق بر قیمت</Badge>
              )}
            </div>
            {p.paymentTerms && <p className="text-xs text-muted-foreground mt-3">شرایط پرداخت: {p.paymentTerms}</p>}
          </div>

          {/* specs grid */}
          <div className="rounded-2xl border bg-card p-5">
            <h2 className="font-black text-sm mb-4">مشخصات ملک</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <Spec icon={<Ruler className="h-4 w-4" />} label="متراژ زمین" value={p.landArea ? `${faNum(p.landArea)} متر` : "—"} />
              <Spec icon={<Building2 className="h-4 w-4" />} label="متراژ بنا" value={p.buildArea ? `${faNum(p.buildArea)} متر` : "—"} />
              <Spec icon={<BedDouble className="h-4 w-4" />} label="اتاق خواب" value={p.bedrooms ? faNum(p.bedrooms) : "—"} />
              <Spec icon={<Bath className="h-4 w-4" />} label="سرویس بهداشتی" value={faNum(p.bathrooms)} />
              <Spec icon={<Building2 className="h-4 w-4" />} label="طبقات" value={faNum(p.floors)} />
              <Spec icon={<CalendarDays className="h-4 w-4" />} label="سال ساخت" value={p.buildYear ? faNum(p.buildYear) : "نوساز/نامشخص"} />
              <Spec icon={<FileCheck2 className="h-4 w-4" />} label="وضعیت سند" value={p.docLabel} />
              <Spec icon={<TreePine className="h-4 w-4" />} label="نوع ملک" value={p.typeLabel} />
            </div>
          </div>

          {/* description */}
          <div className="rounded-2xl border bg-card p-5">
            <h2 className="font-black text-sm mb-3">توضیحات {p.typeLabel}</h2>
            <p className="text-sm leading-8 whitespace-pre-line text-foreground/90">{p.description}</p>
          </div>

          {/* amenities */}
          {(p.allAmenities.length > 0 || p.amenitiesExtra.length > 0) && (
            <div className="rounded-2xl border bg-card p-5">
              <h2 className="font-black text-sm mb-4">امکانات و ویژگی‌ها</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 text-sm">
                {p.allAmenities.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 text-foreground/90">
                    <BadgeCheck className="h-4 w-4 text-teal-600 shrink-0" /> {a.name}
                  </div>
                ))}
                {p.amenitiesExtra.map((x) => (
                  <div key={x} className="flex items-center gap-2 text-foreground/90">
                    <BadgeCheck className="h-4 w-4 text-teal-600 shrink-0" /> {x}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* location */}
          <div className="rounded-2xl border bg-card p-5">
            <h2 className="font-black text-sm mb-3">موقعیت مکانی</h2>
            <p className="text-xs text-muted-foreground mb-3">{p.address || p.province + "، " + p.city}</p>
            {p.lat && p.lng ? (
              <MapView pins={[{ id: p.id, lat: p.lat, lng: p.lng, title: p.title, image: p.image }]} height={320} zoom={14} />
            ) : (
              <div className="rounded-xl bg-muted p-6 text-center text-sm text-muted-foreground">موقعیت نقشه‌ای برای این ملک ثبت نشده است</div>
            )}
          </div>
        </div>

        {/* sidebar */}
        <aside className="space-y-4">
          {/* owner card */}
          <div className="rounded-2xl border bg-card p-5 lg:sticky lg:top-20">
            <div className="flex items-center gap-3">
              <span className="w-12 h-12 rounded-full bg-primary/10 text-primary grid place-items-center font-black overflow-hidden shrink-0">
                {p.owner.photo ? <img src={p.owner.photo} alt={p.owner.name} className="h-full w-full object-cover" /> : p.owner.name.slice(0, 1)}
              </span>
              <div className="min-w-0">
                <div className="font-bold text-sm flex items-center gap-1.5">
                  <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
                  {p.owner.name}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {p.owner.kind === "AGENT" ? "مشاور املاک" : "مالک"}
                  {p.owner.agency ? ` · ${p.owner.agency}` : ""}
                </div>
                {p.owner.verified && (
                  <div className="text-[11px] text-teal-600 font-bold flex items-center gap-1 mt-0.5">
                    <BadgeCheck className="h-3.5 w-3.5" /> هویت تأییدشده
                  </div>
                )}
              </div>
            </div>

            {p.contactPreference !== "MESSAGE" && (
              <Button
                className="w-full mt-4"
                onClick={() => {
                  if (!phoneRevealed) { setPhoneRevealed(true); return; }
                  window.location.href = `tel:${p.owner.phone}`;
                }}
              >
                <Phone className="h-4 w-4" />
                {phoneRevealed ? faNum(p.owner.phone) : "تماس با مالک/مشاور"}
              </Button>
            )}
            {p.contactPreference !== "CALL" && (
              <Button
                variant="outline" className="w-full mt-2"
                onClick={() => (!me ? openAuth("برای ارسال پیام وارد حساب شوید") : setMsgOpen(true))}
              >
                <MessageSquare className="h-4 w-4" /> ارسال پیام
              </Button>
            )}
            <Button className="w-full mt-2" variant="secondary" onClick={() => (!me ? openAuth("برای ثبت درخواست بازدید وارد حساب شوید") : setVisitOpen(true))}>
              <CalendarClock className="h-4 w-4" /> درخواست بازدید ملک
            </Button>
            <p className="text-[10px] text-muted-foreground mt-3 leading-5 text-center">
              روش ارتباط ترجیحی ثبت‌کننده: {CONTACT_PREF_LABELS[p.contactPreference ?? "BOTH"]}
            </p>
          </div>

          {/* similar */}
          {p.similar.length > 0 && (
            <div className="rounded-2xl border bg-card p-5">
              <h2 className="font-black text-sm mb-3 flex items-center gap-1.5">املاک مشابه <ChevronLeft className="h-4 w-4 text-muted-foreground" /></h2>
              <div className="space-y-3">
                {p.similar.slice(0, 4).map((s) => (
                  <Link key={s.id} to={`/property/${s.id}`} className="flex gap-3 group">
                    <span className="w-16 h-14 rounded-lg bg-muted overflow-hidden shrink-0">
                      {s.image && <img src={s.image} alt={s.title} loading="lazy" className="h-full w-full object-cover" />}
                    </span>
                    <span className="min-w-0">
                      <span className="text-xs font-bold line-clamp-1 group-hover:text-primary transition-colors">{s.title}</span>
                      <span className="block text-[11px] text-muted-foreground mt-0.5">{PROPERTY_TYPE_LABELS[s.type] ?? s.type} · {s.city}</span>
                      <span className="block text-[11px] font-bold text-primary mt-0.5">{priceLine(s.transactionType, s.salePrice, s.rahnAmount, s.rentAmount)}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* image lightbox via gallery component (reuse) */}
      <Dialog open={imgOpen} onOpenChange={setImgOpen}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden" dir="rtl">
          <DialogTitle className="sr-only">تصاویر {p.title}</DialogTitle>
          <div className="max-h-[85vh] overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-1">
            {p.images.map((src, i) => (
              <img key={i} src={src} alt={`${p.title} — تصویر ${faNum(i + 1)}`} className="w-full h-40 md:h-52 object-cover" />
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* visit request dialog */}
      <VisitDialog open={visitOpen} onOpenChange={setVisitOpen} property={p} />

      {/* message dialog */}
      <MessageDialog open={msgOpen} onOpenChange={setMsgOpen} property={p} />

      {/* report dialog */}
      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} propertyId={p.id} />
    </div>
  );
}

function Spec({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/60 p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">{icon} {label}</div>
      <div className="font-bold mt-1 text-sm">{value}</div>
    </div>
  );
}

function VisitDialog({ open, onOpenChange, property }: {
  open: boolean; onOpenChange: (v: boolean) => void; property: PropertyDetailT;
}) {
  const { me } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("17:00");
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);

  // prefill from profile the first time the dialog opens
  if (open && !touched && me) {
    setName((n) => n || me.fullName || "");
    setPhone((ph) => ph || me.phone);
    setTouched(true);
  }

  const mutation = useMutation({
    mutationFn: () => api.post(`/api/properties/${property.id}/visit`, {
      name, phone,
      preferredAt: date ? new Date(`${date}T${time}:00`).toISOString() : undefined,
      note: note || undefined,
    }),
    onSuccess: () => {
      toast.success("درخواست بازدید ثبت شد؛ مالک/مشاور با شما هماهنگ می‌کند", { duration: 5000 });
      onOpenChange(false);
      qc.invalidateQueries({ queryKey: ["my-visits"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>درخواست بازدید ملک</DialogTitle>
          <DialogDescription className="line-clamp-1">{property.title}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="v-name">نام و نام خانوادگی</Label>
            <Input id="v-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="نام شما" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="v-phone">شماره تماس</Label>
            <Input id="v-phone" inputMode="tel" dir="ltr" className="text-left" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09123456789" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="v-date">تاریخ پیشنهادی (میلادی)</Label>
              <Input id="v-date" type="date" dir="ltr" className="text-left" value={date} onChange={(e) => setDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-time">ساعت</Label>
              <Input id="v-time" type="time" dir="ltr" className="text-left" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="v-note">توضیحات</Label>
            <Textarea id="v-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثلاً: لطفاً بعدازظهر تماس بگیرید" />
          </div>
          <Button className="w-full" disabled={mutation.isPending || !name || !phone} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "در حال ثبت…" : "ثبت درخواست بازدید"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MessageDialog({ open, onOpenChange, property }: {
  open: boolean; onOpenChange: (v: boolean) => void; property: PropertyDetailT;
}) {
  const [text, setText] = useState("");
  const mutation = useMutation({
    mutationFn: () => api.post("/api/messages", { propertyId: property.id, text }),
    onSuccess: () => {
      toast.success("پیام شما ارسال شد؛ پاسخ در پنل کاربری قابل مشاهده است");
      onOpenChange(false);
      setText("");
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>ارسال پیام به {property.owner.kind === "AGENT" ? "مشاور" : "مالک"}</DialogTitle>
          <DialogDescription className="line-clamp-1">{property.title}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="سؤال خود را بنویسید… مثلاً: آیا امکان بازدید در آخر هفته هست؟" />
          <Button className="w-full" disabled={mutation.isPending || text.trim().length < 3} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "در حال ارسال…" : "ارسال پیام"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReportDialog({ open, onOpenChange, propertyId }: {
  open: boolean; onOpenChange: (v: boolean) => void; propertyId: string;
}) {
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const mutation = useMutation({
    mutationFn: () => api.post(`/api/properties/${propertyId}/report`, { reason, detail: detail || undefined }),
    onSuccess: () => {
      toast.success("گزارش شما ثبت شد؛ کارشناسان حداکثر ظرف ۲۴ ساعت بررسی می‌کنند");
      onOpenChange(false);
      setReason(""); setDetail("");
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle>گزارش آگهی نامعتبر</DialogTitle>
          <DialogDescription>دلیل گزارش خود را انتخاب کنید</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger><SelectValue placeholder="انتخاب دلیل" /></SelectTrigger>
            <SelectContent>
              {REPORT_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Textarea rows={3} value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="توضیح اختیاری…" />
          <Button className="w-full" disabled={mutation.isPending || !reason} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "در حال ارسال…" : "ارسال گزارش"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
