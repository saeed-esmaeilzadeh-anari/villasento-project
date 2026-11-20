"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { ChevronDown, MapPin, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export type RegionOption = {
  id: string;
  name: string;
  nameEn: string;
  typeLabel: string;
  path: string;
  lat: number | null;
  lng: number | null;
  geoStatus: string;
  /** optional legacy City link — keeps old city filters matching */
  legacyCityId?: string | null;
};

/**
 * جستجوی منطقه از دیتابیس واقعی (نام فارسی، لاتین و نام‌های جایگزین).
 * Popover از Radix Portal استفاده می‌کند و MapView با isolation: isolate
 * stacking context نقشه را محبوس می‌کند؛ بنابراین این منو همیشه روی نقشه
 * رندر می‌شود و بریده نمی‌شود.
 */
export function RegionCombobox({
  value,
  onChange,
  placeholder = "انتخاب منطقه…",
  className,
  disabled,
  allowUnverified = true,
  emptyHint,
  triggerSize = "default",
}: {
  value: RegionOption | null;
  onChange: (r: RegionOption | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** when false, regions with UNVERIFIED position are visually muted and rejected */
  allowUnverified?: boolean;
  emptyHint?: string;
  triggerSize?: "sm" | "default";
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const { data, isFetching } = useQuery({
    queryKey: ["regions-search", q],
    queryFn: () => api.get<{ items: RegionOption[] }>(`/api/regions?q=${encodeURIComponent(q)}`),
    enabled: open,
    staleTime: 60 * 1000,
  });

  const items = useMemo(() => data?.items ?? [], [data]);


  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o && !q && value) setQ(value.name); }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          size={triggerSize}
          className={cn("w-full justify-between font-normal h-9", className)}
        >
          <span className="flex items-center gap-1.5 truncate text-sm">
            <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
            {value ? (
              <span className="truncate">
                {value.name}
                {value.geoStatus === "UNVERIFIED" && <span className="text-[9px] text-amber-700 bg-amber-100 rounded px-1 mr-1.5">نیازمند بررسی</span>}
              </span>
            ) : (
              <span className="text-muted-foreground truncate">{placeholder}</span>
            )}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start" sideOffset={4}>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="نام منطقه را بنویسید… (نام‌های جایگزین هم جستجو می‌شود)"
            value={q}
            onValueChange={setQ}
            className="text-xs"
          />
          <CommandList className="max-h-64">
            {isFetching && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> در حال جستجو…
              </div>
            )}
            {!isFetching && q.trim().length >= 2 && items.length === 0 && (
              <CommandEmpty>{emptyHint ?? "منطقه‌ای یافت نشد"}</CommandEmpty>
            )}
            {!isFetching && q.trim().length < 2 && (
              <div className="px-3 py-2.5 text-[11px] text-muted-foreground leading-5">
                حداقل ۲ نویسه بنویسید تا از دیتابیس مناطق جستجو شود — مثلاً «رضویه»، «سنتو» یا «چهارفصل»
              </div>
            )}
            {items.length > 0 && (
              <CommandGroup>
                {items.map((r) => (
                  <CommandItem
                    key={r.id}
                    value={r.id}
                    onSelect={() => {
                      if (!allowUnverified && r.geoStatus !== "VERIFIED") return;
                      onChange(r);
                      setOpen(false);
                    }}
                    className={cn("text-sm", !allowUnverified && r.geoStatus !== "VERIFIED" && "opacity-50")}
                  >
                    <div className="flex flex-col gap-0.5 w-full">
                      <span className="flex items-center gap-1.5 font-bold">
                        {r.name}
                        <span className="text-[10px] font-medium text-muted-foreground">{r.typeLabel}</span>
                        {r.geoStatus === "UNVERIFIED" && (
                          <span className="text-[9px] text-amber-800 bg-amber-100 rounded px-1 flex items-center gap-0.5">
                            <AlertTriangle className="h-2.5 w-2.5" /> نیازمند بررسی
                          </span>
                        )}
                      </span>
                      {r.path && <span className="text-[10px] text-muted-foreground">{r.path}</span>}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
