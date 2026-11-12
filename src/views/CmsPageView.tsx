"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRoute, Link } from "@/lib/router";
import { useSeo } from "@/lib/seo";
import { EmptyState } from "@/components/site/misc";
import { faNum, faDateTime, BRAND } from "@/lib/fa";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";
import { Mail, Send } from "lucide-react";

export function CmsPageView({ slugOverride }: { slugOverride?: string }) {
  const route = useRoute();
  const slug = slugOverride ?? route.path.split("/")[2] ?? "about";

  const { data: page, isLoading } = useQuery({
    queryKey: ["cms", slug],
    queryFn: () => api.get<{ slug: string; title: string; content: string; category: string; updatedAt: string } | null>(`/api/cms/${slug}`),
  });

  useSeo({
    title: page ? `${page.title} | ${BRAND}` : `${BRAND}`,
    description: page?.content.slice(0, 150),
    path: `/page/${slug}`,
    noIndex: !page,
  });

  if (isLoading) return <div className="py-32 text-center text-muted-foreground">در حال بارگذاری…</div>;

  if (!page) {
    return (
      <div className="mx-auto max-w-3xl px-4">
        <EmptyState title="صفحه موردنظر یافت نشد" action={<Link to="/">بازگشت به خانه</Link>} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-black mb-6">{page.title}</h1>
      <div className="rounded-2xl border bg-card p-6 md:p-8">
        <div className="text-sm leading-9 whitespace-pre-line text-foreground/90">
          {page.content}
        </div>
        {slug === "contact" && <ContactForm />}
      </div>
      {page.updatedAt && (
        <div className="mt-6 text-xs text-muted-foreground">
          آخرین به‌روزرسانی: {faDateTime(page.updatedAt)}
        </div>
      )}
    </div>
  );
}

/** Real contact form → POST /api/contact */
function ContactForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const send = useMutation({
    mutationFn: () => api.post("/api/contact", { name, phone, email: email || undefined, subject: subject || undefined, body }),
    onSuccess: () => {
      toast.success("پیام شما ثبت شد؛ کارشناسان در اسرع وقت پاسخ می‌دهند");
      setName(""); setPhone(""); setEmail(""); setSubject(""); setBody("");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <form
      className="mt-8 rounded-2xl border bg-muted/30 p-5 space-y-4"
      onSubmit={(e) => { e.preventDefault(); if (!send.isPending) send.mutate(); }}
      aria-label="فرم تماس با ما"
    >
      <h2 className="font-black text-sm flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /> فرم پیام مستقیم</h2>
      <div className="grid md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="ct-name">نام و نام خانوادگی *</Label>
          <Input id="ct-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ct-phone">شماره تماس *</Label>
          <Input id="ct-phone" inputMode="tel" dir="ltr" className="text-left" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ct-email">ایمیل (اختیاری)</Label>
          <Input id="ct-email" type="email" dir="ltr" className="text-left" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ct-subject">موضوع (اختیاری)</Label>
          <Input id="ct-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ct-body">متن پیام *</Label>
        <Textarea id="ct-body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} required minLength={10} />
      </div>
      <Button type="submit" disabled={send.isPending || !name || !phone || body.trim().length < 10}>
        <Send className="h-4 w-4" /> ارسال پیام
      </Button>
    </form>
  );
}

export function NotFoundView() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <div className="text-7xl font-black text-primary/20">{faNum(404)}</div>
      <h1 className="text-xl font-black mt-4">صفحه پیدا نشد!</h1>
      <p className="text-sm text-muted-foreground mt-2 leading-7">
        آدرسی که وارد کرده‌اید وجود ندارد یا جابه‌جا شده است.
      </p>
      <Link to="/" className="inline-block mt-6 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:opacity-90">
        بازگشت به صفحه اصلی
      </Link>
    </div>
  );
}
