import Link from "next/link";
import { Compass, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] grid place-items-center px-4" dir="rtl">
      <div className="text-center max-w-md">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 text-primary grid place-items-center mb-5">
          <Compass className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-black">صفحه موردنظر پیدا نشد</h1>
        <p className="text-sm text-muted-foreground leading-7 mt-3">
          ممکن است این آگهی حذف شده، به فروش رسیده یا نشانی اشتباه باشد.
          از جستجوی املاک می‌توانید آگهی‌های فعال را ببینید.
        </p>
        <div className="flex flex-wrap justify-center gap-2 mt-6">
          <Link href="/" className="rounded-xl bg-primary text-primary-foreground text-sm font-bold px-4 py-2.5 hover:opacity-90 transition-opacity">
            بازگشت به صفحه اصلی
          </Link>
          <a href="/#/search" className="rounded-xl border text-sm font-bold px-4 py-2.5 hover:border-primary/40 transition-colors flex items-center gap-1.5">
            <Search className="h-4 w-4" /> جستجوی املاک
          </a>
        </div>
      </div>
    </div>
  );
}
