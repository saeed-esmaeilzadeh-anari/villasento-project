"use client";

import { Link } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { faNum, BRAND, nowJalali } from "@/lib/fa";
import { Phone, Mail, MapPin, Clock } from "lucide-react";

type HomeData = {
  site?: { name: string; tagline: string; supportPhone: string; email: string; address: string };
  social?: { label: string; url: string }[];
};

export function Footer() {
  const { data: pages } = useQuery({
    queryKey: ["cms-all"],
    queryFn: () => api.get<{ slug: string; title: string }[]>("/api/cms/all"),
  });
  const { data: home } = useQuery({
    queryKey: ["home-footer"],
    queryFn: () => api.get<HomeData>("/api/home"),
    staleTime: 5 * 60 * 1000,
  });
  const j = nowJalali();
  const site = home?.site;

  return (
    <footer className="mt-auto border-t bg-card">
      <div className="mx-auto max-w-7xl px-4 py-10 grid gap-8 md:grid-cols-4 text-sm">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-8 h-8 rounded-lg bg-primary text-primary-foreground grid place-items-center font-black text-sm">VS</span>
            <span className="font-black text-primary text-lg">{site?.name ?? BRAND}</span>
          </div>
          <p className="text-muted-foreground leading-6 text-xs">
            {site?.tagline ?? "مرجع خرید، فروش، رهن و اجاره باغ، ویلا، باغ‌ویلا و املاک تفریحی و مسکونی با آگهی‌های تأییدشده."}
          </p>
          {!!home?.social?.length && (
            <div className="flex flex-wrap gap-2 mt-3">
              {home.social.map((s) => (
                <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="text-xs rounded-lg border px-2.5 py-1.5 text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
                  {s.label}
                </a>
              ))}
            </div>
          )}
        </div>
        <div>
          <div className="font-bold mb-3">دسترسی سریع</div>
          <ul className="space-y-2 text-muted-foreground">
            <li><Link to="/search" className="hover:text-primary">جستجوی املاک</Link></li>
            <li><Link to="/search?tt=SALE" className="hover:text-primary">املاک برای فروش</Link></li>
            <li><Link to="/search?tt=RAHN" className="hover:text-primary">رهن کامل</Link></li>
            <li><Link to="/new-listing" className="hover:text-primary">ثبت آگهی رایگان</Link></li>
            <li><Link to="/articles" className="hover:text-primary">مقالات و راهنما</Link></li>
          </ul>
        </div>
        <div>
          <div className="font-bold mb-3">راهنما و قوانین</div>
          <ul className="space-y-2 text-muted-foreground">
            {(pages ?? []).map((p) => (
              <li key={p.slug}><Link to={`/page/${p.slug}`} className="hover:text-primary">{p.title}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <div className="font-bold mb-3">ارتباط با ما</div>
          <ul className="space-y-2.5 text-muted-foreground text-xs leading-6">
            <li className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 shrink-0" /> {site?.supportPhone ? faNum(site.supportPhone) : faNum("021-91000000")}</li>
            <li className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 shrink-0" /> {site?.email ?? "info@villasento.example"}</li>
            <li className="flex items-start gap-2"><MapPin className="h-3.5 w-3.5 shrink-0 mt-1" /> {site?.address ?? "تهران"}</li>
            <li className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 shrink-0" /> شنبه تا پنجشنبه ۹ تا ۱۸</li>
            <li className="pt-2 text-[11px]">© {faNum(j.jy)} {site?.name ?? BRAND} — تمامی حقوق محفوظ است</li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
