"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[APP_ERROR]", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] grid place-items-center px-4" dir="rtl">
      <div className="text-center max-w-md">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-red-500/10 text-red-500 grid place-items-center mb-5">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-black">خطای غیرمنتظره</h1>
        <p className="text-sm text-muted-foreground leading-7 mt-3">
          مشکلی در نمایش این بخش پیش آمد. می‌توانید دوباره تلاش کنید یا به صفحه اصلی برگردید.
        </p>
        <div className="flex justify-center gap-2 mt-6">
          <Button onClick={reset} className="gap-1.5">
            <RotateCcw className="h-4 w-4" /> تلاش مجدد
          </Button>
          <Button variant="outline" asChild>
            <a href="/">صفحه اصلی</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
