"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { faNum, faDateTime } from "@/lib/fa";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search } from "lucide-react";
import { EmptyStateInline } from "./Listings";

type AuditRow = {
  id: string; action: string; entity: string; entityId: string | null; meta: string | null;
  actorPhone: string | null; actor: { fullName: string | null; phone: string } | null; createdAt: string;
};

const ACTION_LABELS: Record<string, string> = {
  AUTH_LOGIN: "ورود با OTP", AUTH_LOGIN_PASSWORD: "ورود با رمز", AUTH_OTP_REQUEST: "درخواست کد ورود",
  PASSWORD_SET: "تنظیم رمز", PASSWORD_CHANGE: "تغییر رمز", PASSWORD_RESET: "بازیابی رمز",
  LISTING_SUBMIT: "ارسال آگهی برای تأیید", LISTING_DRAFT: "پیش‌نویس آگهی",
  LISTING_UPDATE: "ویرایش آگهی", LISTING_RESUBMIT: "ارسال مجدد آگهی", LISTING_DELETE: "حذف آگهی",
  LISTING_EXTEND: "تمدید آگهی", LISTING_PUBLISHED: "انتشار آگهی", LISTING_APPROVED: "تأیید آگهی",
  LISTING_REJECTED: "رد آگهی", LISTING_ARCHIVED: "بایگانی آگهی", LISTING_FEATURE_TOGGLE: "تغییر حالت ویژه",
  LISTING_ADMIN_DELETE: "حذف مدیریتی آگهی", LISTING_REPORT: "گزارش آگهی",
  VISIT_REQUEST: "درخواست بازدید", VISIT_STATUS: "تغییر وضعیت بازدید", VISIT_ADMIN_UPDATE: "مدیریت درخواست بازدید",
  CONTACT_MESSAGE: "پیام تماس", CONTACT_UPDATE: "به‌روزرسانی پیام",
  COMPLAINT_REPLY: "پاسخ به گزارش", USER_BLOCK: "مسدودسازی کاربر", USER_UNBLOCK: "رفع مسدودی",
  USER_ROLE_CHANGE: "تغییر نقش", AGENT_CREATE: "افزودن مشاور", AGENT_UPDATE: "ویرایش مشاور",
  AGENT_TOGGLE_ACTIVE: "فعال/غیرفعال مشاور", AGENT_ASSIGN: "تخصیص مشاور",
  ARTICLE_CREATE: "ایجاد مقاله", ARTICLE_UPDATE: "ویرایش مقاله", ARTICLE_DELETE: "حذف مقاله",
  BANNER_CREATE: "ایجاد بنر", BANNER_UPDATE: "ویرایش بنر", CMS_CREATE: "ایجاد صفحه", CMS_UPDATE: "ویرایش صفحه",
  SETTINGS_UPDATE: "به‌روزرسانی تنظیمات", SEED_RUN: "اجرای داده اولیه",
};

export function AuditSection() {
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["admin-audit", q],
    queryFn: () => api.get<{ items: AuditRow[] }>(`/api/admin/audit?q=${encodeURIComponent(q)}`),
  });

  return (
    <div className="space-y-3">
      <div className="relative rounded-2xl border bg-card p-3">
        <Search className="absolute right-6 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pr-9" placeholder="جستجو در عملیات / شماره / موجودیت…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="rounded-2xl border bg-card divide-y">
        {isLoading ? (
          <div className="p-4"><Skeleton className="h-40 rounded-xl" /></div>
        ) : (data?.items.length ?? 0) === 0 ? (
          <EmptyStateInline title="لاگی یافت نشد" />
        ) : (
          data!.items.map((a) => (
            <div key={a.id} className="p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="min-w-0">
                <div className="font-bold">{ACTION_LABELS[a.action] ?? a.action}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {a.entity}{a.entityId ? ` · ${a.entityId.slice(-8)}` : ""} · {a.actor?.fullName ?? a.actorPhone ?? "سیستم"}
                  {a.meta && <span className="line-clamp-1"> · {a.meta.slice(0, 80)}</span>}
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">{faDateTime(a.createdAt)}</span>
            </div>
          ))
        )}
      </div>
      <p className="text-[10px] text-muted-foreground text-center">{data ? `نمایش ${faNum(data.items.length)} رکورد آخر` : ""}</p>
    </div>
  );
}
