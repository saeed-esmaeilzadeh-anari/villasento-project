"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAuth } from "@/lib/store";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { BRAND } from "@/lib/fa";
import { faNum } from "@/lib/fa";
import { cn } from "@/lib/utils";
import { KeyRound, Smartphone, UserPlus, Eye, EyeOff, Loader2, ArrowRight, ShieldAlert } from "lucide-react";

type Mode = "password" | "register" | "otp" | "forgot" | "forced-change";

export function AuthDialog() {
  const { authOpen, authReason, closeAuth, setMe } = useAuth();
  const [mode, setMode] = useState<Mode>("password");
  const [step, setStep] = useState<"start" | "code">("start");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [code, setCode] = useState("");
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setMode("password"); setStep("start"); setCode(""); setDemoCode(null);
    setIsNew(false); setBusy(false); setPassword(""); setPassword2("");
    setNewPassword(""); setNewPassword2(""); setName("");
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
      const res = await api.post<{ user: NonNullable<import("@/lib/api").Me>; mustChangePassword?: boolean }>("/api/auth/verify", {
        phone, code,
        fullName: isNew && name ? name : undefined,
      });
      if (res.mustChangePassword) {
        setMe(res.user);
        setMode("forced-change");
        setBusy(false);
        return;
      }
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
      const res = await api.post<{ user: NonNullable<import("@/lib/api").Me>; mustChangePassword?: boolean }>("/api/auth/password-login", { phone, password });
      if (res.mustChangePassword) {
        setMe(res.user);
        setMode("forced-change");
        setBusy(false);
        return;
      }
      setMe(res.user);
      toast.success(`خوش آمدید${res.user.fullName ? "، " + res.user.fullName : ""}!`);
      closeAuth();
      reset();
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  };

  const doRegister = async () => {
    setBusy(true);
    try {
      const res = await api.post<{ user: NonNullable<import("@/lib/api").Me>; mustChangePassword?: boolean }>("/api/auth/register", {
        phone, password, passwordConfirm: password2, fullName: name || undefined,
      });
      setMe(res.user);
      toast.success("حساب شما با موفقیت ساخته شد؛ خوش آمدید!");
      closeAuth();
      reset();
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  };

  const doForcedChange = async () => {
    setBusy(true);
    try {
      await api.post("/api/auth/change-password", { currentPassword: password, newPassword, });
      await api.post("/api/auth/logout").catch(() => {});
      toast.success("رمز عبور جدید ثبت شد؛ لطفاً با رمز جدید وارد شوید");
      closeAuth();
      reset();
      setMode("password");
    } catch (e) {
      toast.error((e as Error).message);
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

  const showTabs = mode === "password" || mode === "register" || mode === "otp";

  return (
    <Dialog open={authOpen} onOpenChange={(v) => { if (!v) { closeAuth(); reset(); } }}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {mode === "forgot" ? "بازیابی رمز عبور"
              : mode === "forced-change" ? "تغییر اجباری رمز عبور"
              : mode === "register" ? `ثبت‌نام در ${BRAND}`
              : isNew && mode === "otp" ? "ساخت حساب جدید"
              : `ورود به ${BRAND}`}
          </DialogTitle>
          <DialogDescription>
            {mode === "forced-change"
              ? "برای امنیت حساب، ابتدا رمز عبور اولیه را با یک رمز شخصی جایگزین کنید"
              : authReason ?? (mode === "forgot"
                ? "کد تأیید نمایشی و رمز جدید را وارد کنید"
                : mode === "register"
                ? "با شماره موبایل و رمز عبور، حساب بسازید (بدون نیاز به کد تأیید)"
                : "با شماره موبایل و رمز عبور وارد شوید")}
          </DialogDescription>
        </DialogHeader>

        {mode === "forced-change" && (
          <div className="space-y-3">
            <div className="rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-950/40 px-3 py-2.5 text-xs flex items-start gap-2 text-amber-800 dark:text-amber-300">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
              حساب شما با رمز اولیه تنظیم شده است. لطفاً رمز شخصی و امن انتخاب کنید.
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fc-pw">رمز عبور جدید</Label>
              <Input id="fc-pw" type="password" dir="ltr" className="text-left" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              <p className="text-[10px] text-muted-foreground">حداقل ۶ نویسه</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fc-pw2">تکرار رمز عبور جدید</Label>
              <Input id="fc-pw2" type="password" dir="ltr" className="text-left" value={newPassword2} onChange={(e) => setNewPassword2(e.target.value)} />
            </div>
            <Button className="w-full" disabled={busy || newPassword.length < 6 || newPassword !== newPassword2} onClick={doForcedChange}>
              {busy && <Loader2 className="h-4 w-4 animate-spin ml-1" />} ثبت رمز و ادامه
            </Button>
            {newPassword && newPassword2 && newPassword !== newPassword2 && (
              <p className="text-xs text-red-500">رمز و تکرار آن یکسان نیست</p>
            )}
          </div>
        )}

        {showTabs && step === "start" && (
          <div className="space-y-3">
            <div className="flex rounded-xl bg-muted p-1 text-sm font-medium" role="tablist" aria-label="روش ورود">
              <button
                className={cn("flex-1 rounded-lg py-2 transition-colors flex items-center justify-center gap-1.5", mode === "password" ? "bg-background shadow-sm font-bold" : "text-muted-foreground")}
                onClick={() => setMode("password")}
                role="tab" aria-selected={mode === "password"}
              >
                <KeyRound className="h-4 w-4" /> ورود
              </button>
              <button
                className={cn("flex-1 rounded-lg py-2 transition-colors flex items-center justify-center gap-1.5", mode === "register" ? "bg-background shadow-sm font-bold" : "text-muted-foreground")}
                onClick={() => setMode("register")}
                role="tab" aria-selected={mode === "register"}
              >
                <UserPlus className="h-4 w-4" /> ثبت‌نام
              </button>
              <button
                className={cn("flex-1 rounded-lg py-2 transition-colors flex items-center justify-center gap-1.5", mode === "otp" ? "bg-background shadow-sm font-bold" : "text-muted-foreground")}
                onClick={() => setMode("otp")}
                role="tab" aria-selected={mode === "otp"}
              >
                <Smartphone className="h-4 w-4" /> کد
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

            {mode === "password" && (
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
            )}

            {mode === "register" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="reg-name">نام و نام خانوادگی</Label>
                  <Input id="reg-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً علی رضایی" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-pw">رمز عبور</Label>
                  <Input id="reg-pw" type={showPw ? "text" : "password"} dir="ltr" className="text-left" value={password} onChange={(e) => setPassword(e.target.value)} />
                  <p className="text-[10px] text-muted-foreground">حداقل ۶ نویسه</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-pw2">تکرار رمز عبور</Label>
                  <Input id="reg-pw2" type="password" dir="ltr" className="text-left" value={password2} onChange={(e) => setPassword2(e.target.value)} />
                </div>
                {password && password2 && password !== password2 && (
                  <p className="text-xs text-red-500">رمز عبور و تکرار آن یکسان نیست</p>
                )}
                <Button className="w-full" disabled={busy || !phone || password.length < 6 || password !== password2} onClick={doRegister}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin ml-1" />} ساخت حساب و ورود
                </Button>
                <p className="text-[11px] text-muted-foreground leading-5">
                  با ثبت‌نام، <b>شرایط استفاده</b> از خدمات ویلاسنتو را می‌پذیرید. شماره موبایل شما هویت ورود است و پس از اتصال پنل پیامک، تأیید می‌شود.
                </p>
              </div>
            )}

            {mode === "otp" && (
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
