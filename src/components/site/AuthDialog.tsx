"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/store";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { faNum, BRAND } from "@/lib/fa";
import { Loader2, Smartphone, KeyRound, Eye, EyeOff, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "password" | "otp" | "forgot";

export function AuthDialog() {
  const { authOpen, authReason, closeAuth, setMe } = useAuth();
  const [mode, setMode] = useState<Mode>("password");
  const [step, setStep] = useState<"start" | "code">("start");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [code, setCode] = useState("");
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setMode("password"); setStep("start"); setCode(""); setDemoCode(null);
    setIsNew(false); setBusy(false); setPassword(""); setNewPassword("");
  };

  const requestOtp = async (target?: string) => {
    setBusy(true);
    try {
      const res = await api.post<{ isNewUser: boolean; demoCode?: string }>("/api/auth/request-otp", { phone: target ?? phone });
      setIsNew(res.isNewUser);
      setDemoCode(res.demoCode ?? null);
      setStep("code");
      toast.success("کد تأیید ارسال شد" + (res.demoCode ? ` (کد نمایشی: ${faNum(res.demoCode)})` : ""));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    try {
      const res = await api.post<{ user: NonNullable<import("@/lib/api").Me> }>("/api/auth/verify", {
        phone, code,
        fullName: isNew && name ? name : undefined,
      });
      setMe(res.user);
      toast.success(`خوش آمدید${res.user.fullName ? "، " + res.user.fullName : ""}!`);
      closeAuth();
      reset();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const loginPassword = async () => {
    setBusy(true);
    try {
      const res = await api.post<{ user: NonNullable<import("@/lib/api").Me> }>("/api/auth/password-login", { phone, password });
      setMe(res.user);
      toast.success(`خوش آمدید${res.user.fullName ? "، " + res.user.fullName : ""}!`);
      closeAuth();
      reset();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doResetPassword = async () => {
    setBusy(true);
    try {
      await api.post("/api/auth/reset-password", { phone, code, newPassword });
      toast.success("رمز عبور جدید ثبت شد؛ اکنون وارد شوید");
      setMode("password");
      setPassword("");
      setStep("start");
      setBusy(false);
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Dialog open={authOpen} onOpenChange={(v) => { if (!v) { closeAuth(); reset(); } }}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {mode === "forgot" ? "بازیابی رمز عبور" : isNew && mode === "otp" ? "ساخت حساب جدید" : `ورود به ${BRAND}`}
          </DialogTitle>
          <DialogDescription>
            {authReason ??
              (mode === "forgot"
                ? "کد تأیید پیامکی و رمز جدید را وارد کنید"
                : "با شماره موبایل یا رمز عبور وارد شوید")}
          </DialogDescription>
        </DialogHeader>

        {mode !== "forgot" && step === "start" && (
          <div className="space-y-3">
            <div className="flex rounded-xl bg-muted p-1 text-sm font-medium" role="tablist" aria-label="روش ورود">
              <button
                className={cn("flex-1 rounded-lg py-2 transition-colors flex items-center justify-center gap-1.5", mode === "password" ? "bg-background shadow-sm font-bold" : "text-muted-foreground")}
                onClick={() => setMode("password")}
                role="tab" aria-selected={mode === "password"}
              >
                <KeyRound className="h-4 w-4" /> رمز عبور
              </button>
              <button
                className={cn("flex-1 rounded-lg py-2 transition-colors flex items-center justify-center gap-1.5", mode === "otp" ? "bg-background shadow-sm font-bold" : "text-muted-foreground")}
                onClick={() => setMode("otp")}
                role="tab" aria-selected={mode === "otp"}
              >
                <Smartphone className="h-4 w-4" /> کد یکبارمصرف
              </button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="auth-phone">شماره موبایل</Label>
              <Input
                id="auth-phone" inputMode="tel" dir="ltr" className="text-left"
                placeholder="۰۹۱۲۳۴۵۶۷۸۹" value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            {mode === "password" ? (
              <div className="space-y-1.5">
                <Label htmlFor="auth-pw">رمز عبور</Label>
                <div className="relative">
                  <Input
                    id="auth-pw" type={showPw ? "text" : "password"} dir="ltr" className="text-left pl-10"
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && phone && password) loginPassword(); }}
                  />
                  <button type="button" className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? "پنهان کردن رمز" : "نمایش رمز"}>
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <button type="button" className="text-xs text-primary hover:underline" onClick={() => { setMode("forgot"); setStep("start"); }}>
                  رمز عبور را فراموش کرده‌ام
                </button>
                <Button className="w-full" disabled={busy || !phone || !password} onClick={loginPassword}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin ml-1" />} ورود
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="auth-name">نام و نام خانوادگی <span className="text-[10px] text-muted-foreground">(برای ثبت‌نام)</span></Label>
                  <Input id="auth-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="اختیاری" />
                </div>
                <Button className="w-full" disabled={busy || !phone} onClick={() => requestOtp()}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin ml-1" />} دریافت کد تأیید
                </Button>
              </>
            )}
          </div>
        )}

        {(mode === "otp" || mode === "forgot") && step === "code" && (
          <div className="space-y-3">
            <Button variant="ghost" size="sm" className="p-0 h-8" onClick={() => { setStep("start"); setCode(""); setDemoCode(null); }}>
              <ArrowRight className="h-4 w-4 ml-1" /> تغییر شماره
            </Button>
            <p className="text-sm text-muted-foreground">کد ارسال‌شده به {faNum(phone)} را وارد کنید</p>
            {demoCode && (
              <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-xs text-primary">
                حالت نمایشی — کد تأیید: <b className="font-black tracking-widest">{faNum(demoCode)}</b>
              </div>
            )}
            <div className="flex justify-center" dir="ltr">
              <InputOTP maxLength={5} value={code} onChange={setCode}>
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4].map((i) => <InputOTPSlot key={i} index={i} />)}
                </InputOTPGroup>
              </InputOTP>
            </div>
            {mode === "otp" ? (
              <Button className="w-full" disabled={busy || code.length < 5} onClick={verify}>
                {busy && <Loader2 className="h-4 w-4 animate-spin ml-1" />} تأیید و ورود
              </Button>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="new-pw">رمز عبور جدید</Label>
                  <Input id="new-pw" type="password" dir="ltr" className="text-left" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                  <p className="text-[10px] text-muted-foreground">حداقل ۶ نویسه</p>
                </div>
                <Button className="w-full" disabled={busy || code.length < 5 || newPassword.length < 6} onClick={doResetPassword}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin ml-1" />} ثبت رمز جدید
                </Button>
              </>
            )}
            <button type="button" className="text-xs text-muted-foreground hover:text-primary mx-auto block" onClick={() => requestOtp()}>
              ارسال مجدد کد
            </button>
          </div>
        )}

        {mode === "forgot" && step === "start" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="fp-phone">شماره موبایل حساب</Label>
              <Input id="fp-phone" inputMode="tel" dir="ltr" className="text-left" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <Button className="w-full" disabled={busy || !phone} onClick={() => requestOtp()}>
              {busy && <Loader2 className="h-4 w-4 animate-spin ml-1" />} ارسال کد بازیابی
            </Button>
            <button type="button" className="text-xs text-muted-foreground hover:text-primary" onClick={() => setMode("password")}>
              بازگشت به ورود
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
