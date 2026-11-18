"use client";

import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { buildMonth, monthAdd, nowJalali, faDate, faNum, J_WEEKDAYS } from "@/lib/fa";
import { cn } from "@/lib/utils";
import { CalendarDays, ChevronRight, ChevronLeft } from "lucide-react";
import { toJalaali } from "jalaali-js";

/**
 * Jalali (Persian) date picker — fully Persian: month names, Saturday-first
 * weeks, RTL. Value/contract with the API stays Gregorian ISO (YYYY-MM-DD);
 * conversion is centralized in src/lib/fa.ts (jalaali-js).
 */
export function JalaliDatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = "انتخاب تاریخ",
  clearable = false,
  className,
  buttonClassName,
  id,
}: {
  value: string; // Gregorian "YYYY-MM-DD" or ""
  onChange: (gregorianISO: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  clearable?: boolean;
  className?: string;
  buttonClassName?: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const today = useMemo(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  }, []);
  const jalaliOf = (gregorian: string): { jy: number; jm: number } => {
    const [y, m, d] = gregorian.split("-").map(Number);
    const j = toJalaali(y, m, d);
    return { jy: j.jy, jm: j.jm };
  };
  const [cursor, setCursor] = useState(() => (value ? jalaliOf(value) : nowJalali()));

  const month = useMemo(() => buildMonth(cursor.jy, cursor.jm, min, max), [cursor, min, max]);

  const disabled = (d: string): boolean => Boolean((min && d < min) || (max && d > max));

  return (
    <span className={cn("inline-flex", className)}>
      <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) setCursor(value ? jalaliOf(value) : nowJalali()); }}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            className={cn("w-full justify-between font-normal", !value && "text-muted-foreground", buttonClassName)}
            aria-haspopup="dialog"
          >
            <span className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              {value ? faDate(value) : placeholder}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" align="end" dir="rtl">
          {/* header */}
          <div className="flex items-center justify-between mb-2">
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8"
              aria-label="ماه قبل"
              onClick={() => setCursor((c) => monthAdd(c.jy, c.jm, -1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <div className="text-sm font-bold">{month.monthName}</div>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8"
              aria-label="ماه بعد"
              onClick={() => setCursor((c) => monthAdd(c.jy, c.jm, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
          {/* weekdays (Saturday-first) */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {J_WEEKDAYS.map((w, i) => (
              <div key={i} className="text-center text-[11px] text-muted-foreground py-1">{w}</div>
            ))}
          </div>
          {/* days */}
          <div className="grid grid-cols-7 gap-1" role="grid" aria-label="تقویم شمسی">
            {month.weeks.flat().map((d, i) =>
              d === null ? (
                <span key={i} />
              ) : (
                <button
                  key={i}
                  type="button"
                  disabled={disabled(d)}
                  onClick={() => { onChange(d); setOpen(false); }}
                  className={cn(
                    "h-9 rounded-lg text-sm tabular-nums transition-colors",
                    d === value && "bg-primary text-primary-foreground font-bold",
                    d !== value && d === today && "bg-primary/10 text-primary font-bold",
                    d !== value && d !== today && !disabled(d) && "hover:bg-muted",
                    disabled(d) && "text-muted-foreground/40 cursor-not-allowed"
                  )}
                  aria-pressed={d === value}
                  aria-label={faDate(d, { withYear: false })}
                >
                  {faNum(Number(d.split("-")[2]))}
                </button>
              )
            )}
          </div>
          {/* footer */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t">
            <Button type="button" variant="ghost" size="sm" className="h-8 text-xs"
              disabled={disabled(today)}
              onClick={() => { onChange(today); setOpen(false); }}>
              امروز
            </Button>
            {clearable && value && (
              <Button type="button" variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground"
                onClick={() => { onChange(""); setOpen(false); }}>
                پاک کردن
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </span>
  );
}

/** Date-range pair (from/to) — used by admin filters; both stay Gregorian ISO for APIs */
export function JalaliDateRange({ from, to, onFrom, onTo, className }: {
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <JalaliDatePicker value={from} onChange={onFrom} max={to || undefined} clearable placeholder="از تاریخ" className="w-40" />
      <span className="text-muted-foreground text-sm">تا</span>
      <JalaliDatePicker value={to} onChange={onTo} min={from || undefined} clearable placeholder="تا تاریخ" className="w-40" />
    </div>
  );
}
