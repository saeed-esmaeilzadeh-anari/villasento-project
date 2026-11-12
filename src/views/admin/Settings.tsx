"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

type SettingsMap = Record<string, string>;

const GROUPS: { title: string; keys: { key: string; label: string; type?: "text" | "textarea" | "number"; ltr?: boolean }[] }[] = [
  {
    title: "هویت برند و اطلاعات مجموعه",
    keys: [
      { key: "site.name", label: "نام سامانه" },
      { key: "site.nameEn", label: "نام لاتین" },
      { key: "site.tagline", label: "شعار (تگ‌لاین)", type: "textarea" },
      { key: "site.supportPhone", label: "تلفن پشتیبانی" },
      { key: "site.email", label: "ایمیل", ltr: true },
      { key: "site.address", label: "نشانی" },
      { key: "site.workingHours", label: "ساعات کاری" },
    ],
  },
  {
    title: "سئو",
    keys: [
      { key: "seo.defaultTitle", label: "عنوان پیش‌فرض صفحات" },
      { key: "seo.defaultDescription", label: "توضیحات پیش‌فرض (Meta Description)", type: "textarea" },
    ],
  },
  {
    title: "آگهی‌ها",
    keys: [
      { key: "listing.validityDays", label: "مدت اعتبار آگهی (روز)", type: "number", ltr: true },
      { key: "listing.maxImages", label: "حداکثر تصویر هر آگهی", type: "number", ltr: true },
    ],
  },
  {
    title: "نقشه",
    keys: [
      { key: "map.centerLat", label: "عرض جغرافیایی مرکز نقشه", ltr: true },
      { key: "map.centerLng", label: "طول جغرافیایی مرکز نقشه", ltr: true },
      { key: "map.zoom", label: "زوم پیش‌فرض", type: "number", ltr: true },
    ],
  },
  {
    title: "پیامک و ایمیل",
    keys: [
      { key: "sms.demoMode", label: "حالت نمایشی پیامک (true/false)", ltr: true },
      { key: "sms.provider", label: "سرویس‌دهنده پیامک (kavenegar/smsir — خالی = غیرفعال)", ltr: true },
      { key: "sms.apiKey", label: "کلید API پیامک", ltr: true },
      { key: "email.smtpConfigured", label: "ایمیل SMTP فعال (true/false)", ltr: true },
    ],
  },
  {
    title: "آپلود",
    keys: [
      { key: "upload.maxSizeMB", label: "حداکثر حجم تصویر (مگابایت)", type: "number", ltr: true },
    ],
  },
];

export function SettingsSection() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => api.get<SettingsMap>("/api/admin/settings"),
  });
  const [values, setValues] = useState<SettingsMap | null>(null);
  const [busy, setBusy] = useState(false);

  // when fresh settings arrive and no local edits exist, adopt them
  if (data && values === null) setValues(data);
  const current: SettingsMap = values ?? data ?? {};

  const save = useMutation({
    mutationFn: (changed: SettingsMap) => api.post("/api/admin/settings", { action: "update", data: changed }),
    onSuccess: () => { toast.success("تنظیمات ذخیره شد"); setValues(null); qc.invalidateQueries({ queryKey: ["admin-settings"] }); qc.invalidateQueries({ queryKey: ["home"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const dirty: SettingsMap = {};
  for (const [k, v] of Object.entries(current)) {
    if (data && data[k] !== v) dirty[k] = v;
  }

  if (isLoading) return <Skeleton className="h-64 rounded-2xl" />;

  return (
    <div className="space-y-4">
      {GROUPS.map((g) => (
        <div key={g.title} className="rounded-2xl border bg-card p-5">
          <h3 className="font-black text-sm mb-4">{g.title}</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {g.keys.map((k) => (
              <div key={k.key} className="space-y-1.5">
                <Label htmlFor={`st-${k.key}`} className="text-xs">{k.label}</Label>
                {k.type === "textarea" ? (
                  <Textarea
                    id={`st-${k.key}`} rows={2} className="text-xs"
                    value={current[k.key] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [k.key]: e.target.value }))}
                  />
                ) : (
                  <Input
                    id={`st-${k.key}`} className="text-xs"
                    type={k.type === "number" ? "number" : "text"}
                    dir={k.ltr ? "ltr" : "auto"}
                    value={current[k.key] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [k.key]: e.target.value }))}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3 sticky bottom-4 rounded-2xl border bg-card/95 backdrop-blur p-3 shadow-lg">
        <Button disabled={busy || Object.keys(dirty).length === 0} onClick={() => { setBusy(true); save.mutate(dirty); setTimeout(() => setBusy(false), 800); }}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          ذخیره {Object.keys(dirty).length > 0 ? `(${Object.keys(dirty).length} تغییر)` : ""}
        </Button>
        <p className="text-[11px] text-muted-foreground">بدون کلید واقعی پیامک، سامانه در حالت نمایشی می‌ماند (بدون نمایش موفقیت ساختگی).</p>
      </div>
    </div>
  );
}
