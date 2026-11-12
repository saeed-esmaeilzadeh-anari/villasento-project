"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type PropertyDetailT } from "@/lib/api";
import { Link } from "@/lib/router";
import { useCompare } from "@/lib/store";
import { useSeo } from "@/lib/seo";
import { faNum, priceLine, DOCUMENT_STATUS_LABELS, PROPERTY_TYPE_LABELS, TRANSACTION_TYPE_LABELS } from "@/lib/fa";
import { PropertyCard } from "@/components/site/PropertyCard";
import { EmptyState } from "@/components/site/misc";
import { Button } from "@/components/ui/button";
import { X, GitCompareArrows } from "lucide-react";

export function CompareView() {
  const compare = useCompare();
  useSeo({ title: "مقایسه املاک | ویلاسنتو", noIndex: true });

  const { data, isLoading } = useQuery({
    queryKey: ["compare", compare.ids.join(",")],
    queryFn: () => api.get<{ items: (PropertyDetailT | null)[] }>(`/api/properties?ids=${compare.ids.join(",")}`),
    enabled: compare.ids.length > 0,
  });

  const items = (data?.items ?? []).filter(Boolean) as PropertyDetailT[];

  const rows: { label: string; get: (p: PropertyDetailT) => string }[] = [
    { label: "نوع معامله", get: (p) => TRANSACTION_TYPE_LABELS[p.transactionType] ?? p.transactionType },
    { label: "نوع ملک", get: (p) => p.typeLabel },
    { label: "قیمت", get: (p) => priceLine(p.transactionType, p.salePrice, p.rahnAmount, p.rentAmount) },
    { label: "موقعیت", get: (p) => `${p.province}، ${p.city}${p.area ? "، " + p.area : ""}` },
    { label: "متراژ زمین", get: (p) => (p.landArea ? `${faNum(p.landArea)} م²` : "—") },
    { label: "متراژ بنا", get: (p) => (p.buildArea ? `${faNum(p.buildArea)} م²` : "—") },
    { label: "اتاق خواب", get: (p) => (p.bedrooms ? faNum(p.bedrooms) : "—") },
    { label: "سرویس بهداشتی", get: (p) => faNum(p.bathrooms) },
    { label: "سال ساخت", get: (p) => (p.buildYear ? faNum(p.buildYear) : "—") },
    { label: "وضعیت سند", get: (p) => DOCUMENT_STATUS_LABELS[p.documentStatus] ?? p.documentStatus },
    { label: "امکان توافق", get: (p) => (p.negotiable ? "دارد" : "ندارد") },
    { label: "بازدید", get: (p) => faNum(p.viewCount) },
    { label: "ثبت‌کننده", get: (p) => `${p.owner.name}${p.owner.kind === "AGENT" ? " (مشاور)" : ""}` },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex items-center justify-between gap-3 mb-5">
        <h1 className="text-xl font-black flex items-center gap-2"><GitCompareArrows className="h-5 w-5 text-primary" /> مقایسه املاک</h1>
        {compare.ids.length > 0 && (
          <Button variant="outline" size="sm" onClick={compare.clear}>پاک کردن لیست</Button>
        )}
      </div>

      {compare.ids.length === 0 ? (
        <EmptyState
          icon={<GitCompareArrows className="h-12 w-12" />}
          title="ملکی برای مقایسه انتخاب نشده"
          desc="در صفحه نتایج جستجو یا جزئیات هر ملک، دکمه مقایسه را بزنید (حداکثر ۴ ملک)."
          action={<Button asChild><Link to="/search">جستجوی املاک</Link></Button>}
        />
      ) : isLoading ? (
        <div className="grid md:grid-cols-3 gap-4">{compare.ids.map((id) => <div key={id} className="h-64 rounded-2xl bg-muted animate-pulse" />)}</div>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(240px, 1fr))` }}>
            {items.map((p) => (
              <div key={p.id} className="rounded-2xl border bg-card p-3 space-y-3">
                <div className="relative">
                  <PropertyCard p={p} />
                  <button
                    className="absolute -top-2 -left-2 z-10 rounded-full bg-red-500 text-white p-1.5 shadow"
                    onClick={() => compare.remove(p.id)}
                    aria-label={`حذف ${p.title} از مقایسه`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <table className="w-full mt-4 text-sm border rounded-2xl overflow-hidden">
            <tbody className="divide-y">
              {rows.map((r, i) => (
                <tr key={r.label} className={i % 2 === 0 ? "bg-muted/40" : ""}>
                  <th className="text-right p-3 text-xs font-black text-muted-foreground w-28">{r.label}</th>
                  {items.map((p) => <td key={p.id} className="p-3 text-xs font-bold leading-6">{r.get(p)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
