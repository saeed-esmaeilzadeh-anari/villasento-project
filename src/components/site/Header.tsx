"use client";

import { api, type Me } from "@/lib/api";
import { useAuth, useCompare } from "@/lib/store";
import { Link, navigate } from "@/lib/router";
import { faNum, ROLE_LABELS, BRAND } from "@/lib/fa";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import {
  Heart, LogOut, Menu, Bell, Home, Search, Building2, ShieldCheck,
  LayoutDashboard, UserRound, KeyRound, Phone, X, UserPlus, GitCompareArrows,
  Newspaper, PlusCircle, Scale,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { AuthDialog } from "./AuthDialog";

export type MenuItem = { label: string; to: string };

export const DEFAULT_MENU: MenuItem[] = [
  { label: "صفحه اصلی", to: "/" },
  { label: "جستجوی املاک", to: "/search" },
  { label: "فروش", to: "/search?tt=SALE" },
  { label: "رهن و اجاره", to: "/search?tt=RAHN_RENT" },
  { label: "مقالات", to: "/articles" },
];

export function Header() {
  const { me, loading, openAuth, logout } = useAuth();
  const compareCount = useCompare((s) => s.ids.length);
  const { data: notif } = useQuery({
    queryKey: ["notifications", me?.id],
    queryFn: () => api.get<{ items: { id: string; title: string; body: string; readAt: string | null; createdAt: string; link?: string | null }[]; unread: number }>("/api/notifications"),
    enabled: !!me,
    refetchInterval: 30000,
  });

  const [mobileOpen, setMobileOpen] = useState(false);
  const links = DEFAULT_MENU;

  const canPanel = me && me.role !== "CUSTOMER";
  const isAdmin = me && (me.role === "ADMIN" || me.role === "SUPER_ADMIN");

  return (
    <>
      <header className="sticky top-0 z-40 glass border-b">
        <div className="mx-auto max-w-7xl px-4 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {/* Mobile menu */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="منو">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 p-4">
                <div className="font-black text-lg mb-4 text-primary">{BRAND}</div>
                <nav className="flex flex-col gap-1">
                  {links.map((l) => (
                    <Link key={l.to} to={l.to} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-muted" onClick={() => setMobileOpen(false)}>
                      {l.label}
                    </Link>
                  ))}
                  <Link to="/new-listing" className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-primary hover:bg-primary/5" onClick={() => setMobileOpen(false)}>
                    <PlusCircle className="h-4 w-4" /> ثبت آگهی رایگان
                  </Link>
                  {me && (
                    <>
                      {canPanel && (
                        <Link to="/account" className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-muted" onClick={() => setMobileOpen(false)}>
                          <LayoutDashboard className="h-4 w-4" /> پنل کاربری
                        </Link>
                      )}
                      {isAdmin && (
                        <Link to="/admin" className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-muted" onClick={() => setMobileOpen(false)}>
                          <ShieldCheck className="h-4 w-4" /> پنل مدیریت
                        </Link>
                      )}
                      <Link to="/account" className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-muted" onClick={() => setMobileOpen(false)}>
                        <UserRound className="h-4 w-4" /> حساب من
                      </Link>
                      <Link to="/favorites" className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-muted" onClick={() => setMobileOpen(false)}>
                        <Heart className="h-4 w-4" /> علاقه‌مندی‌ها
                      </Link>
                      <Link to="/compare" className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-muted" onClick={() => setMobileOpen(false)}>
                        <GitCompareArrows className="h-4 w-4" /> مقایسه املاک {compareCount > 0 && `(${faNum(compareCount)})`}
                      </Link>
                    </>
                  )}
                  {!me && (
                    <Button className="mt-2" onClick={() => { setMobileOpen(false); openAuth(); }}>
                      ورود | ثبت‌نام
                    </Button>
                  )}
                </nav>
              </SheetContent>
            </Sheet>

            <Link to="/" className="flex items-center gap-2" aria-label="ویلاسنتو — صفحه اصلی">
              <span className="w-9 h-9 rounded-xl bg-primary text-primary-foreground grid place-items-center font-black text-base leading-none">VS</span>
              <span className="text-xl font-black text-primary hidden sm:block">{BRAND}</span>
            </Link>

            <nav className="hidden md:flex items-center gap-1 mr-4">
              {links.map((l) => (
                <Link key={l.to} to={l.to} className="px-3 py-2 rounded-lg text-sm font-medium text-foreground/80 hover:bg-muted hover:text-foreground transition-colors">
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-1.5">
            <Button asChild variant="outline" size="sm" className="hidden md:inline-flex font-bold border-primary/30 text-primary hover:bg-primary/5">
              <Link to="/new-listing">
                <PlusCircle className="h-4 w-4" />
                ثبت آگهی رایگان
              </Link>
            </Button>

            {loading ? (
              <div className="w-24 h-9 rounded-lg bg-muted animate-pulse" />
            ) : me ? (
              <>
                <Button asChild variant="ghost" size="icon" className="relative hidden sm:inline-flex" aria-label="مقایسه املاک">
                  <Link to="/compare">
                    <GitCompareArrows className="h-5 w-5" />
                    {compareCount > 0 && (
                      <span className="absolute -top-0.5 -left-0.5 h-4 min-w-4 rounded-full bg-primary text-primary-foreground text-[10px] grid place-items-center px-1">
                        {faNum(compareCount)}
                      </span>
                    )}
                  </Link>
                </Button>
                {/* notifications */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative" aria-label="اعلان‌ها">
                      <Bell className="h-5 w-5" />
                      {!!notif?.unread && (
                        <span className="absolute -top-0.5 -left-0.5 h-4 min-w-4 rounded-full bg-red-500 text-white text-[10px] grid place-items-center px-1">
                          {faNum(notif.unread)}
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-80 max-h-96 overflow-y-auto scrollbar-thin">
                    <DropdownMenuLabel>اعلان‌ها</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {notif?.items?.length ? (
                      notif.items.map((n) => (
                        <DropdownMenuItem
                          key={n.id}
                          className={cn("flex-col items-start gap-0.5 py-2.5", !n.readAt && "bg-primary/5")}
                          onClick={() => { if (n.link) navigate(n.link); }}
                        >
                          <span className="text-sm font-semibold">{n.title}</span>
                          <span className="text-xs text-muted-foreground line-clamp-2">{n.body}</span>
                        </DropdownMenuItem>
                      ))
                    ) : (
                      <div className="text-center text-sm text-muted-foreground py-6">اعلانی ندارید</div>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* user menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 rounded-full p-1 pl-2 hover:bg-muted transition-colors" aria-label="منوی کاربری">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                          {(me.fullName ?? me.phone).slice(0, 1)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="hidden sm:block text-sm font-medium max-w-28 truncate">{me.fullName ?? faNum(me.phone)}</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-60">
                    <DropdownMenuLabel>
                      <div className="text-sm font-bold">{me.fullName ?? "کاربر ویلاسنتو"}</div>
                      <div className="text-xs text-muted-foreground font-normal">{faNum(me.phone)} · {ROLE_LABELS[me.role] ?? me.role}</div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate("/account")}><UserRound className="h-4 w-4 ml-2" /> پنل کاربری و آگهی‌های من</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/favorites")}><Heart className="h-4 w-4 ml-2" /> علاقه‌مندی‌ها</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/compare")}><GitCompareArrows className="h-4 w-4 ml-2" /> مقایسه املاک</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/new-listing")}><PlusCircle className="h-4 w-4 ml-2" /> ثبت آگهی جدید</DropdownMenuItem>
                    {isAdmin && (
                      <DropdownMenuItem onClick={() => navigate("/admin")}><ShieldCheck className="h-4 w-4 ml-2" /> پنل مدیریت</DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => logout().then(() => toast.success("از حساب خارج شدید"))}>
                      <LogOut className="h-4 w-4 ml-2" /> خروج
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <Button onClick={() => openAuth()} className="font-bold">
                <UserPlus className="h-4 w-4 ml-1" />
                ورود | ثبت‌نام
              </Button>
            )}
          </div>
        </div>
      </header>
      <AuthDialog />
    </>
  );
}

// quick-login helper used by AuthDialog demo section
export function DemoHint() {
  const [hint, setHint] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setHint(false), 15000);
    return () => clearTimeout(t);
  }, []);
  if (!hint) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-72 rounded-xl border bg-card p-3 text-xs shadow-lg">
      <button className="absolute top-1 left-1 text-muted-foreground hover:text-foreground" onClick={() => setHint(false)} aria-label="بستن">
        <X className="h-3.5 w-3.5" />
      </button>
      <div className="font-bold mb-1 flex items-center gap-1"><KeyRound className="h-3.5 w-3.5" /> حساب‌های آزمایشی</div>
      <div className="space-y-0.5 text-muted-foreground leading-5">
        <div>مدیر: {faNum("09120000001")}</div>
        <div>مشاور: {faNum("09120000002")}</div>
        <div>مالک: {faNum("09120000005")}</div>
        <div>کاربر: {faNum("09123456789")}</div>
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground">رمز همه: {faNum("123456")} — یا کد OTP نمایشی</div>
    </div>
  );
}

export function NotFoundInline({ title = "یافت نشد" }: { title?: string }) {
  return (
    <div className="text-center py-20 text-muted-foreground">
      <DialogDescription>{title}</DialogDescription>
    </div>
  );
}
