"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, uploadImage } from "@/lib/api";
import { faNum, faDateTime } from "@/lib/fa";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { EmptyStateInline } from "./Listings";

export function CmsSection() {
  return (
    <Tabs defaultValue="articles" dir="rtl">
      <TabsList className="flex-wrap h-auto gap-1 bg-transparent p-0">
        <TabsTrigger value="articles" className="rounded-lg border text-xs font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">مقالات</TabsTrigger>
        <TabsTrigger value="banners" className="rounded-lg border text-xs font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">بنرها</TabsTrigger>
        <TabsTrigger value="faqs" className="rounded-lg border text-xs font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">سؤالات متداول</TabsTrigger>
        <TabsTrigger value="pages" className="rounded-lg border text-xs font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">صفحات ثابت</TabsTrigger>
      </TabsList>
      <TabsContent value="articles" className="mt-4"><ArticlesAdmin /></TabsContent>
      <TabsContent value="banners" className="mt-4"><BannersAdmin /></TabsContent>
      <TabsContent value="faqs" className="mt-4"><FaqsAdmin /></TabsContent>
      <TabsContent value="pages" className="mt-4"><PagesAdmin /></TabsContent>
    </Tabs>
  );
}

// ───────── Articles ─────────
type ArticleT = {
  id: string; title: string; slug: string; excerpt: string; content: string;
  coverUrl: string | null; categoryId: string | null; category?: { name: string } | null;
  tags: string; viewCount: number; isPublished: boolean; publishedAt: string | null; createdAt: string;
  author?: { fullName: string | null } | null;
};

function ArticlesAdmin() {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<Partial<ArticleT> | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-articles"],
    queryFn: () => api.get<{ items: ArticleT[] }>("/api/admin/articles"),
  });
  const { data: cats } = useQuery({
    queryKey: ["article-categories-admin"],
    queryFn: () => api.get<{ categories: { id: string; name: string; slug: string }[] }>("/api/articles"),
  });

  const act = useMutation({
    mutationFn: (p: { action: string; id?: string; data?: unknown }) => api.post("/api/admin/articles", p),
    onSuccess: () => { toast.success("انجام شد"); qc.invalidateQueries({ queryKey: ["admin-articles"] }); qc.invalidateQueries({ queryKey: ["articles"] }); setEdit(null); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-2xl border bg-card p-3">
        <span className="text-xs text-muted-foreground">{data ? `${faNum(data.items.length)} مقاله` : ""}</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { const name = window.prompt("نام دسته جدید:"); if (name?.trim()) act.mutate({ action: "upsert-category", data: { name: name.trim() } }); }}>دسته جدید</Button>
          <Button size="sm" onClick={() => setEdit({ isPublished: true })}><Plus className="h-4 w-4" /> مقاله جدید</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
      ) : (data?.items.length ?? 0) === 0 ? (
        <EmptyStateInline title="مقاله‌ای ثبت نشده" />
      ) : (
        <div className="space-y-3">
          {data!.items.map((a) => (
            <div key={a.id} className="rounded-2xl border bg-card p-4 flex items-center gap-3">
              <span className="w-16 h-14 rounded-lg bg-muted overflow-hidden shrink-0">
                {a.coverUrl && <img src={a.coverUrl} alt={a.title} className="h-full w-full object-cover" />}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={a.isPublished ? "bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]" : "bg-stone-100 text-stone-600 border-stone-200 text-[10px]"}>{a.isPublished ? "منتشرشده" : "پیش‌نویس"}</Badge>
                  {a.category && <span className="text-[10px] text-muted-foreground">{a.category.name}</span>}
                  <span className="text-[10px] text-muted-foreground">{faNum(a.viewCount)} بازدید</span>
                </div>
                <div className="text-xs font-bold mt-1.5 line-clamp-1">{a.title}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5" dir="ltr">/{a.slug}</div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Button size="sm" variant="outline" onClick={() => setEdit(a)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="ghost" className="text-red-600" onClick={() => { if (window.confirm("مقاله حذف شود؟")) act.mutate({ action: "delete", id: a.id }); }}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ArticleDialog
        open={!!edit}
        article={edit}
        categories={cats?.categories ?? []}
        onClose={() => setEdit(null)}
        onSave={(payload) => act.mutate({ action: "upsert", id: edit?.id, data: payload })}
        busy={act.isPending}
      />
    </div>
  );
}

function ArticleDialog({ open, article, categories, onClose, onSave, busy }: {
  open: boolean; article: Partial<ArticleT> | null; categories: { id: string; name: string }[];
  onClose: () => void; onSave: (p: Record<string, unknown>) => void; busy: boolean;
}) {
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [categoryId, setCategoryId] = useState("none");
  const [tags, setTags] = useState("");
  const [isPublished, setIsPublished] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = article?.id ?? "new";

  if (open && lastKey !== key) {
    setLastKey(key);
    setTitle(article?.title ?? "");
    setExcerpt(article?.excerpt ?? "");
    setContent(article?.content ?? "");
    setCoverUrl(article?.coverUrl ?? "");
    setCategoryId(article?.categoryId ?? "none");
    setTags(article?.tags ?? "");
    setIsPublished(article?.isPublished ?? true);
  }
  if (!open && lastKey !== null) setLastKey(null);

  const doUpload = async (file: File) => {
    setUploading(true);
    try {
      const res = await uploadImage(file, undefined, "articles");
      setCoverUrl(res.url);
      toast.success("تصویر کاور آپلود شد");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{article?.id ? "ویرایش مقاله" : "مقاله جدید"}</DialogTitle>
          <DialogDescription>در صورت خالی گذاشتن خلاصه، از ابتدای متن گرفته می‌شود</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ar-title">عنوان *</Label>
            <Input id="ar-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ar-excerpt">خلاصه</Label>
            <Input id="ar-excerpt" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ar-content">متن کامل *</Label>
            <Textarea id="ar-content" rows={9} value={content} onChange={(e) => setContent(e.target.value)} />
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>دسته‌بندی</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون دسته</SelectItem>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ar-tags">برچسب‌ها (با ویرگول)</Label>
              <Input id="ar-tags" value={tags} onChange={(e) => setTags(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>تصویر کاور</Label>
            <div className="flex items-center gap-3">
              {coverUrl && <img src={coverUrl} alt="کاور" className="w-24 h-16 object-cover rounded-lg border" />}
              <label className="flex items-center gap-2 text-xs rounded-xl border border-dashed px-4 py-3 cursor-pointer hover:border-primary/50">
                <ImagePlus className="h-4 w-4 text-primary" />
                {uploading ? "در حال آپلود…" : "انتخاب تصویر"}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) doUpload(f); e.target.value = ""; }} />
              </label>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch checked={isPublished} onCheckedChange={setIsPublished} aria-label="انتشار" />
            <span className="text-sm font-bold">انتشار عمومی</span>
          </label>
          <Button
            className="w-full" disabled={busy || !title.trim() || !content.trim()}
            onClick={() => onSave({ title, excerpt, content, coverUrl: coverUrl || undefined, categoryId: categoryId === "none" ? undefined : categoryId, tags, isPublished })}
          >
            ذخیره مقاله
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ───────── Banners ─────────
type BannerT = { id: string; title: string; imageUrl: string; link: string | null; position: string; sort: number; isActive: boolean };
const BANNER_POSITIONS: Record<string, string> = { HOME_TOP: "بالای صفحه اصلی", HOME_MID: "میانه صفحه اصلی", HOME_BOTTOM: "پایین صفحه اصلی", SIDEBAR: "سایدبار" };

function BannersAdmin() {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<Partial<BannerT> | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-banners"],
    queryFn: () => api.get<{ items: BannerT[] }>("/api/admin/banners"),
  });
  const act = useMutation({
    mutationFn: (p: { action: string; id?: string; data?: unknown }) => api.post("/api/admin/banners", p),
    onSuccess: () => { toast.success("انجام شد"); qc.invalidateQueries({ queryKey: ["admin-banners"] }); qc.invalidateQueries({ queryKey: ["home"] }); setEdit(null); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-2xl border bg-card p-3">
        <span className="text-xs text-muted-foreground">{data ? `${faNum(data.items.length)} بنر` : ""}</span>
        <Button size="sm" onClick={() => setEdit({ position: "HOME_MID", isActive: true, sort: 0 })}><Plus className="h-4 w-4" /> بنر جدید</Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-24 rounded-2xl" />
      ) : (data?.items.length ?? 0) === 0 ? (
        <EmptyStateInline title="بنری ثبت نشده" />
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {data!.items.map((b) => (
            <div key={b.id} className="rounded-2xl border bg-card overflow-hidden">
              <img src={b.imageUrl} alt={b.title} className="h-28 w-full object-cover" />
              <div className="p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[10px]">{BANNER_POSITIONS[b.position] ?? b.position}</Badge>
                  <Badge className={b.isActive ? "bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]" : "bg-stone-100 text-stone-600 border-stone-200 text-[10px]"}>{b.isActive ? "فعال" : "غیرفعال"}</Badge>
                  <span className="text-[10px] text-muted-foreground">ترتیب {faNum(b.sort)}</span>
                </div>
                <div className="text-xs font-bold mt-1.5">{b.title}</div>
                <div className="flex gap-1.5 mt-2">
                  <Button size="sm" variant="outline" onClick={() => setEdit(b)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => { if (window.confirm("بنر حذف شود؟")) act.mutate({ action: "delete", id: b.id }); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader><DialogTitle>{edit?.id ? "ویرایش بنر" : "بنر جدید"}</DialogTitle><DialogDescription>تصویر بنر با آپلود واقعی ذخیره می‌شود</DialogDescription></DialogHeader>
          <BannerForm banner={edit} busy={act.isPending} onSave={(p) => act.mutate({ action: "upsert", id: edit?.id, data: p })} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BannerForm({ banner, onSave, busy }: { banner: Partial<BannerT> | null; onSave: (p: Record<string, unknown>) => void; busy: boolean }) {
  const [title, setTitle] = useState(banner?.title ?? "");
  const [imageUrl, setImageUrl] = useState(banner?.imageUrl ?? "");
  const [link, setLink] = useState(banner?.link ?? "");
  const [position, setPosition] = useState(banner?.position ?? "HOME_MID");
  const [sort, setSort] = useState(String(banner?.sort ?? 0));
  const [isActive, setIsActive] = useState(banner?.isActive ?? true);
  const [uploading, setUploading] = useState(false);

  const doUpload = async (file: File) => {
    setUploading(true);
    try {
      const res = await uploadImage(file, undefined, "banners");
      setImageUrl(res.url);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="bn-title">عنوان بنر *</Label>
        <Input id="bn-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>تصویر *</Label>
        {imageUrl && <img src={imageUrl} alt="پیش‌نمایش" className="w-full h-24 object-cover rounded-lg border" />}
        <label className="flex items-center gap-2 text-xs rounded-xl border border-dashed px-4 py-3 cursor-pointer hover:border-primary/50">
          <ImagePlus className="h-4 w-4 text-primary" />
          {uploading ? "در حال آپلود…" : "انتخاب تصویر"}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) doUpload(f); e.target.value = ""; }} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="bn-link">لینک (اختیاری)</Label>
          <Input id="bn-link" dir="ltr" className="text-left" value={link} onChange={(e) => setLink(e.target.value)} placeholder="#/search?tt=SALE" />
        </div>
        <div className="space-y-1.5">
          <Label>موقعیت</Label>
          <Select value={position} onValueChange={setPosition}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(BANNER_POSITIONS).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 items-end">
        <div className="space-y-1.5">
          <Label htmlFor="bn-sort">ترتیب نمایش</Label>
          <Input id="bn-sort" inputMode="numeric" dir="ltr" className="text-left" value={sort} onChange={(e) => setSort(e.target.value.replace(/\D/g, ""))} />
        </div>
        <label className="flex items-center gap-2 cursor-pointer pb-2">
          <Switch checked={isActive} onCheckedChange={setIsActive} aria-label="فعال" />
          <span className="text-sm font-bold">فعال</span>
        </label>
      </div>
      <Button className="w-full" disabled={busy || !title.trim() || !imageUrl} onClick={() => onSave({ title, imageUrl, link: link || undefined, position, sort: Number(sort) || 0, isActive })}>
        ذخیره بنر
      </Button>
    </div>
  );
}

// ───────── FAQs ─────────
type FaqT = { id: string; question: string; answer: string; sort: number; isActive: boolean };

function FaqsAdmin() {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<Partial<FaqT> | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-faqs"],
    queryFn: () => api.get<{ items: FaqT[] }>("/api/admin/faqs"),
  });
  const act = useMutation({
    mutationFn: (p: { action: string; id?: string; data?: unknown }) => api.post("/api/admin/faqs", p),
    onSuccess: () => { toast.success("انجام شد"); qc.invalidateQueries({ queryKey: ["admin-faqs"] }); qc.invalidateQueries({ queryKey: ["home"] }); setEdit(null); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-2xl border bg-card p-3">
        <span className="text-xs text-muted-foreground">{data ? `${faNum(data.items.length)} سؤال` : ""}</span>
        <Button size="sm" onClick={() => setEdit({ isActive: true, sort: (data?.items.length ?? 0) + 1 })}><Plus className="h-4 w-4" /> سؤال جدید</Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-24 rounded-2xl" />
      ) : (data?.items.length ?? 0) === 0 ? (
        <EmptyStateInline title="سؤالی ثبت نشده" />
      ) : (
        <div className="space-y-3">
          {data!.items.map((f) => (
            <div key={f.id} className="rounded-2xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-bold">{f.question}</div>
                  <p className="text-[11px] text-muted-foreground leading-5 mt-1 line-clamp-2">{f.answer}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Badge className={f.isActive ? "bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]" : "bg-stone-100 text-stone-600 border-stone-200 text-[10px]"}>{f.isActive ? "فعال" : "غیرفعال"}</Badge>
                  <Button size="sm" variant="outline" onClick={() => setEdit(f)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => { if (window.confirm("حذف شود؟")) act.mutate({ action: "delete", id: f.id }); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader><DialogTitle>{edit?.id ? "ویرایش سؤال" : "سؤال جدید"}</DialogTitle></DialogHeader>
          <FaqForm faq={edit} onSave={(p) => act.mutate({ action: "upsert", id: edit?.id, data: p })} busy={act.isPending} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FaqForm({ faq, onSave, busy }: { faq: Partial<FaqT> | null; onSave: (p: Record<string, unknown>) => void; busy: boolean }) {
  const [question, setQuestion] = useState(faq?.question ?? "");
  const [answer, setAnswer] = useState(faq?.answer ?? "");
  const [sort, setSort] = useState(String(faq?.sort ?? 0));
  const [isActive, setIsActive] = useState(faq?.isActive ?? true);
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="fq-q">سؤال *</Label>
        <Input id="fq-q" value={question} onChange={(e) => setQuestion(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fq-a">پاسخ *</Label>
        <Textarea id="fq-a" rows={4} value={answer} onChange={(e) => setAnswer(e.target.value)} />
      </div>
      <div className="flex items-center gap-4">
        <div className="space-y-1.5 flex-1">
          <Label htmlFor="fq-s">ترتیب</Label>
          <Input id="fq-s" inputMode="numeric" dir="ltr" className="text-left" value={sort} onChange={(e) => setSort(e.target.value.replace(/\D/g, ""))} />
        </div>
        <label className="flex items-center gap-2 cursor-pointer pt-5">
          <Switch checked={isActive} onCheckedChange={setIsActive} aria-label="فعال" />
          <span className="text-sm font-bold">فعال</span>
        </label>
      </div>
      <Button className="w-full" disabled={busy || !question.trim() || !answer.trim()} onClick={() => onSave({ question, answer, sort: Number(sort) || 0, isActive })}>ذخیره</Button>
    </div>
  );
}

// ───────── CMS pages ─────────
type PageT = { id: string; slug: string; title: string; content: string; category: string; isPublished: boolean; updatedAt: string };

function PagesAdmin() {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<Partial<PageT> | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-cms"],
    queryFn: () => api.get<{ items: PageT[] }>("/api/admin/cms"),
  });
  const act = useMutation({
    mutationFn: (p: { action: string; id?: string; data?: unknown }) => api.post("/api/admin/cms", p),
    onSuccess: () => { toast.success("انجام شد"); qc.invalidateQueries({ queryKey: ["admin-cms"] }); qc.invalidateQueries({ queryKey: ["cms-all"] }); qc.invalidateQueries({ queryKey: ["cms"] }); setEdit(null); },
    onError: (e) => toast.error((e as Error).message),
  });
  const CATS: Record<string, string> = { GENERAL: "عمومی", LEGAL: "قوانین", HELP: "راهنما" };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-2xl border bg-card p-3">
        <span className="text-xs text-muted-foreground">{data ? `${faNum(data.items.length)} صفحه` : ""}</span>
        <Button size="sm" onClick={() => setEdit({ isPublished: true, category: "GENERAL" })}><Plus className="h-4 w-4" /> صفحه جدید</Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-24 rounded-2xl" />
      ) : (data?.items.length ?? 0) === 0 ? (
        <EmptyStateInline title="صفحه‌ای ثبت نشده" />
      ) : (
        <div className="space-y-3">
          {data!.items.map((p) => (
            <div key={p.id} className="rounded-2xl border bg-card p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{CATS[p.category] ?? p.category}</Badge>
                  <Badge className={p.isPublished ? "bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]" : "bg-stone-100 text-stone-600 border-stone-200 text-[10px]"}>{p.isPublished ? "منتشرشده" : "پیش‌نویس"}</Badge>
                </div>
                <div className="text-xs font-bold mt-1.5">{p.title}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5" dir="ltr">/page/{p.slug} · {faDateTime(p.updatedAt)}</div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Button size="sm" variant="outline" onClick={() => setEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="ghost" className="text-red-600" onClick={() => { if (window.confirm("صفحه حذف شود؟")) act.mutate({ action: "delete", id: p.id }); }}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader><DialogTitle>{edit?.id ? "ویرایش صفحه" : "صفحه جدید"}</DialogTitle></DialogHeader>
          <PageForm page={edit} onSave={(p) => act.mutate({ action: "upsert", id: edit?.id, data: p })} busy={act.isPending} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PageForm({ page, onSave, busy }: { page: Partial<PageT> | null; onSave: (p: Record<string, unknown>) => void; busy: boolean }) {
  const [title, setTitle] = useState(page?.title ?? "");
  const [slug, setSlug] = useState(page?.slug ?? "");
  const [content, setContent] = useState(page?.content ?? "");
  const [category, setCategory] = useState(page?.category ?? "GENERAL");
  const [isPublished, setIsPublished] = useState(page?.isPublished ?? true);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="pg-title">عنوان *</Label>
          <Input id="pg-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pg-slug">نامک (انگلیسی) *</Label>
          <Input id="pg-slug" dir="ltr" className="text-left" value={slug} onChange={(e) => setSlug(e.target.value.replace(/[^a-z0-9-]/gi, "").toLowerCase())} placeholder="about" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>دسته</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="GENERAL">عمومی</SelectItem>
            <SelectItem value="LEGAL">قوانین</SelectItem>
            <SelectItem value="HELP">راهنما</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pg-content">محتوا *</Label>
        <Textarea id="pg-content" rows={9} value={content} onChange={(e) => setContent(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <Switch checked={isPublished} onCheckedChange={setIsPublished} aria-label="انتشار" />
        <span className="text-sm font-bold">منتشر شود</span>
      </label>
      <Button className="w-full" disabled={busy || !title.trim() || !slug.trim() || !content.trim()} onClick={() => onSave({ title, slug, content, category, isPublished })}>ذخیره صفحه</Button>
    </div>
  );
}
