import { toJalaali, toGregorian, jalaaliMonthLength } from "jalaali-js";

// ── Persian digits & money ──
const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
export function faNum(input: string | number): string {
  return String(input).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

export function money(n: number): string {
  return faNum(Math.round(n).toLocaleString("en-US").replace(/,/g, "٬"));
}

/** 12500000000 → «۱۲٫۵ میلیارد تومان» */
export function shortMoney(n: number): string {
  if (n >= 1_000_000_000) {
    const v = n / 1_000_000_000;
    return `${faNum(v % 1 === 0 ? v : Number(v.toFixed(1)))} میلیارد تومان`;
  }
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${faNum(v % 1 === 0 ? v : Number(v.toFixed(1)))} میلیون تومان`;
  }
  if (n >= 1000) return `${faNum(Math.round(n / 1000))} هزار تومان`;
  return `${money(n)} تومان`;
}

/** Price line per transaction type */
export function priceLine(tt: string, salePrice?: number | null, rahn?: number | null, rent?: number | null): string {
  if (tt === "SALE") return salePrice ? shortMoney(salePrice) : "توافقی";
  if (tt === "RAHN") return rahn ? `رهن ${shortMoney(rahn)}` : "توافقی";
  if (tt === "RAHN_RENT") {
    const r = rahn ? shortMoney(rahn) : "—";
    const m = rent ? shortMoney(rent) : "—";
    return `رهن ${r} + اجاره ${m}`;
  }
  return rent ? `${shortMoney(rent)} در ماه` : "توافقی";
}

// ── Jalali dates ──
export const J_MONTHS = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
];
export const J_WEEKDAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"]; // Saturday-first
const G_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function todayStr(): string {
  const dt = new Date();
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export function addDaysStr(s: string, n: number): string {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/** "2025-03-14" → "۲۳ اسفند ۱۴۰۳" */
export function faDate(s: string, opts?: { withYear?: boolean; withMonth?: boolean }): string {
  if (!s) return "";
  const [y, m, d] = s.split("-").map(Number);
  try {
    const j = toJalaali(y, m, d);
    const base = `${faNum(j.jd)} ${J_MONTHS[j.jm - 1]}`;
    return opts?.withYear === false ? base : `${base} ${faNum(j.jy)}`;
  } catch {
    return s;
  }
}

export function faDateLong(s: string): string {
  if (!s) return "";
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const wd = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"][dt.getDay()];
  try {
    const j = toJalaali(y, m, d);
    return `${wd} ${faNum(j.jd)} ${J_MONTHS[j.jm - 1]} ${faNum(j.jy)}`;
  } catch {
    return s;
  }
}

export function faDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const dt = typeof iso === "string" ? new Date(iso) : iso;
  const s = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  const hh = String(dt.getHours()).padStart(2, "0");
  const mm = String(dt.getMinutes()).padStart(2, "0");
  return `${faDate(s)} ساعت ${faNum(hh)}:${faNum(mm)}`;
}

/** Persian weekday index with Saturday=0 */
export function jalaliWeekday(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return (dt.getDay() + 1) % 7;
}

export type JMonthInfo = { jy: number; jm: number; weeks: (string | null)[][]; monthName: string };

/** Build a month grid (Saturday-first) of dateStr cells */
export function buildMonth(jy: number, jm: number, minDate?: string, maxDate?: string): JMonthInfo {
  const g = toGregorian(jy, jm, 1);
  const first = `${g.gy}-${String(g.gm).padStart(2, "0")}-01`;
  const len = jalaaliMonthLength(jy, jm);
  const startWd = jalaliWeekday(first);
  const cells: (string | null)[] = Array(startWd).fill(null);
  for (let d = 1; d <= len; d++) {
    const g2 = toGregorian(jy, jm, d);
    cells.push(`${g2.gy}-${String(g2.gm).padStart(2, "0")}-${String(g2.gd).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return { jy, jm, weeks, monthName: `${J_MONTHS[jm - 1]} ${faNum(jy)}` };
}

export function nowJalali(): { jy: number; jm: number } {
  const t = new Date();
  const j = toJalaali(t.getFullYear(), t.getMonth() + 1, t.getDate());
  return { jy: j.jy, jm: j.jm };
}

export function monthAdd(jy: number, jm: number, delta: number): { jy: number; jm: number } {
  let m = jm + delta;
  let y = jy;
  while (m > 12) { m -= 12; y += 1; }
  while (m < 1) { m += 12; y -= 1; }
  return { jy: y, jm: m };
}

export function gMonthName(idx: number): string {
  return G_MONTHS[idx];
}

/** Jalali year helper for build-year selects */
export function currentJalaliYear(): number {
  return nowJalali().jy;
}

// ── VillaSento domain labels ──
export const BRAND = "ویلاسنتو";
export const BRAND_EN = "VillaSento";

export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  SALE: "فروش",
  RAHN: "رهن کامل",
  RAHN_RENT: "رهن و اجاره",
  RENT: "اجاره ماهانه",
};

export const TRANSACTION_TYPE_COLORS: Record<string, string> = {
  SALE: "bg-emerald-100 text-emerald-800 border-emerald-200",
  RAHN: "bg-amber-100 text-amber-800 border-amber-200",
  RAHN_RENT: "bg-teal-100 text-teal-800 border-teal-200",
  RENT: "bg-stone-100 text-stone-700 border-stone-200",
};

export const PROPERTY_TYPE_LABELS: Record<string, string> = {
  GARDEN: "باغ",
  VILLA: "ویلا",
  GARDEN_VILLA: "باغ‌ویلا",
  HOUSE: "خانه ویلایی",
  APARTMENT: "آپارتمان",
  LAND: "زمین و کلنگی",
};

export const DOCUMENT_STATUS_LABELS: Record<string, string> = {
  MALIKI: "مالکیتی",
  SIX_DANG: "شش‌دانگ",
  SINGLE_SHEET: "تک‌برگ",
  WATHIQI: "واعثی",
  COLLECTIVE: "قولنامه‌ای/تفکیکی",
  WITHOUT_DOC: "بدون سند",
};

export const LISTING_STATUS_LABELS: Record<string, string> = {
  DRAFT: "پیش‌نویس",
  PENDING: "در انتظار تأیید",
  APPROVED: "تأییدشده",
  PUBLISHED: "منتشرشده",
  REJECTED: "ردشده",
  EXPIRED: "منقضی‌شده",
  ARCHIVED: "بایگانی",
};

export const LISTING_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-stone-100 text-stone-700 border-stone-200",
  PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  APPROVED: "bg-teal-100 text-teal-800 border-teal-200",
  PUBLISHED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  REJECTED: "bg-red-100 text-red-700 border-red-200",
  EXPIRED: "bg-orange-100 text-orange-800 border-orange-200",
  ARCHIVED: "bg-stone-100 text-stone-500 border-stone-200",
};

export const VISIT_STATUS_LABELS: Record<string, string> = {
  NEW: "جدید",
  IN_PROGRESS: "در حال پیگیری",
  DONE: "انجام‌شده",
  CANCELLED: "لغوشده",
};

export const VISIT_STATUS_COLORS: Record<string, string> = {
  NEW: "bg-amber-100 text-amber-800 border-amber-200",
  IN_PROGRESS: "bg-teal-100 text-teal-800 border-teal-200",
  DONE: "bg-emerald-100 text-emerald-800 border-emerald-200",
  CANCELLED: "bg-stone-100 text-stone-500 border-stone-200",
};

export const MSG_STATUS_LABELS: Record<string, string> = VISIT_STATUS_LABELS;

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "مدیر ارشد",
  ADMIN: "مدیر",
  AGENT: "مشاور املاک",
  OWNER: "مالک",
  CUSTOMER: "کاربر",
  HOST: "میزبان (legacy)",
};

export const CONTACT_PREF_LABELS: Record<string, string> = {
  CALL: "تماس تلفنی",
  MESSAGE: "پیام در سایت",
  BOTH: "تماس یا پیام",
};

export const REPORT_REASONS = [
  "قیمت نامعتبر است",
  "ملک فروخته/اجاره داده شده است",
  "تصاویر با ملک مطابقت ندارد",
  "اطلاعات تماس اشتباه است",
  "آگهی تکراری است",
  "مشتبه دیگر",
];

export function pluralRooms(n: number): string {
  if (!n) return "بدون اتاق";
  return `${faNum(n)} خواب`;
}
