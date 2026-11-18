"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PALETTE_PRESETS, useTheme, type ThemeMode } from "@/components/theme/ThemeProvider";
import { faNum } from "@/lib/fa";
import { cn } from "@/lib/utils";
import { Sun, Moon, Clock, Monitor, Check } from "lucide-react";

const MODES: { key: ThemeMode; label: string; icon: React.ReactNode }[] = [
  { key: "light", label: "روشن", icon: <Sun className="h-4 w-4" /> },
  { key: "dark", label: "تاریک", icon: <Moon className="h-4 w-4" /> },
  { key: "auto", label: "خودکار (ساعت)", icon: <Clock className="h-4 w-4" /> },
  { key: "system", label: "هماهنگ با سیستم", icon: <Monitor className="h-4 w-4" /> },
];

function Seg<T extends string>({ value, onChange, options }: {
  value: T;
  onChange: (v: T) => void;
  options: { key: T; label: string }[];
}) {
  return (
    <div className="flex rounded-xl bg-muted p-1 text-sm font-medium" role="group">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="radio"
          aria-checked={value === o.key}
          className={cn(
            "flex-1 rounded-lg py-1.5 transition-colors",
            value === o.key ? "bg-background shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => onChange(o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Theme & appearance settings — every change applies instantly, no reload */
export function ThemeSettingsPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const prefs = useTheme((s) => s.prefs);
  const set = useTheme((s) => s.set);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[min(92vw,380px)] overflow-y-auto p-5" dir="rtl">
        <SheetHeader className="p-0 text-right">
          <SheetTitle className="font-black">تنظیمات ظاهری</SheetTitle>
          <SheetDescription className="text-xs">
            حالت نمایش، رنگ‌بندی، اندازه فونت و تراکم — برای مهمان در همین مرورگر و برای حساب کاربری در پروفایل شما ذخیره می‌شود.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-5">
          {/* mode */}
          <div>
            <Label className="text-xs mb-1.5 block">حالت نمایش</Label>
            <Seg value={prefs.mode} onChange={(v) => set({ mode: v })} options={MODES.map((m) => ({ key: m.key, label: m.label }))} />
            {prefs.mode === "auto" && (
              <div className="mt-2 rounded-xl border bg-muted/40 p-3 space-y-2">
                <div className="text-xs text-muted-foreground">بازه روز در حالت خودکار (ساعت ۰ تا ۲۳):</div>
                <div className="flex items-center gap-2">
                  <Input type="number" min={0} max={23} value={prefs.dayStart}
                    onChange={(e) => set({ dayStart: Math.min(23, Math.max(0, Number(e.target.value) || 0)) })}
                    className="w-16 text-center" aria-label="ساعت شروع روز" />
                  <span className="text-xs text-muted-foreground">تا</span>
                  <Input type="number" min={0} max={23} value={prefs.dayEnd}
                    onChange={(e) => set({ dayEnd: Math.min(23, Math.max(0, Number(e.target.value) || 0)) })}
                    className="w-16 text-center" aria-label="ساعت شروع شب" />
                  <span className="text-xs text-muted-foreground mr-auto">
                    روز: {faNum(prefs.dayStart)} تا {faNum(prefs.dayEnd)} — شب: خارج از این بازه
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* palette */}
          <div>
            <Label className="text-xs mb-1.5 block">رنگ اصلی</Label>
            <div className="grid grid-cols-4 gap-2">
              {PALETTE_PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => set({ palette: p.key })}
                  className={cn(
                    "relative rounded-xl border-2 p-2 flex flex-col items-center gap-1.5 transition-colors hover:bg-muted/60",
                    prefs.palette === p.key ? "border-primary" : "border-border"
                  )}
                  aria-pressed={prefs.palette === p.key}
                  aria-label={p.label}
                >
                  <span className="w-7 h-7 rounded-full shadow-inner" style={{ background: p.color }} />
                  <span className="text-[10px] leading-none">{p.label}</span>
                  {prefs.palette === p.key && (
                    <Check className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-primary text-primary-foreground p-0.5" />
                  )}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <label className="text-xs text-muted-foreground shrink-0">رنگ دلخواه:</label>
              <input
                type="color"
                value={prefs.palette === "custom" && prefs.customColor ? prefs.customColor : "#0d5c46"}
                onChange={(e) => set({ palette: "custom", customColor: e.target.value })}
                className="w-10 h-9 rounded-lg border cursor-pointer bg-transparent"
                aria-label="انتخاب رنگ دلخواه"
              />
              {prefs.palette === "custom" && (
                <span className="text-xs text-muted-foreground">{prefs.customColor}</span>
              )}
            </div>
          </div>

          {/* font size */}
          <div>
            <Label className="text-xs mb-1.5 block">اندازه فونت</Label>
            <Seg value={prefs.fontSize} onChange={(v) => set({ fontSize: v })}
              options={[{ key: "s", label: "کوچک" }, { key: "m", label: "متوسط" }, { key: "l", label: "بزرگ" }]} />
          </div>

          {/* density */}
          <div>
            <Label className="text-xs mb-1.5 block">تراکم نمایش</Label>
            <Seg value={prefs.density} onChange={(v) => set({ density: v })}
              options={[{ key: "comfortable", label: "استاندارد" }, { key: "compact", label: "فشرده" }]} />
          </div>

          {/* radius */}
          <div>
            <Label className="text-xs mb-1.5 block">گردی گوشه‌ها</Label>
            <Seg value={prefs.radius} onChange={(v) => set({ radius: v })}
              options={[{ key: "s", label: "کم" }, { key: "m", label: "متوسط" }, { key: "l", label: "زیاد" }]} />
          </div>

          <div className="text-[11px] text-muted-foreground leading-5 rounded-xl bg-muted/40 p-3">
            تغییرات بلافاصله در کل سایت اعمال می‌شود و پس از Refresh باقی می‌ماند. برای خروج از حالت خودکار، یکی از حالت‌های روشن یا تاریک را انتخاب کنید.
          </div>

          <Button variant="outline" className="w-full" onClick={() => set({
            mode: "auto", palette: "brand", customColor: null, fontSize: "m", density: "comfortable", radius: "m", dayStart: 7, dayEnd: 19,
          })}>
            بازگشت به تنظیمات پیش‌فرض
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
