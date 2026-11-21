import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "صفحه پیدا نشد | ویلاسنتو",
  description: "صفحه‌ای که به دنبال آن هستید وجود ندارد یا در دسترس نیست.",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[65vh] max-w-xl flex-col items-center justify-center px-4 py-20 text-center" dir="rtl">
      <p className="text-7xl font-black text-primary/20">۴۰۴</p>
      <h1 className="mt-5 text-2xl font-black">صفحه موردنظر پیدا نشد</h1>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">
        ممکن است آدرس تغییر کرده باشد یا آگهی دیگر در دسترس نباشد.
      </p>
      <Link href="/" className="mt-6 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground">
        بازگشت به صفحه اصلی
      </Link>
    </main>
  );
}
