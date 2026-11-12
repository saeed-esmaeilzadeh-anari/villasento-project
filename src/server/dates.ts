/** Date helpers — everything is stored as "YYYY-MM-DD" strings (SQLite friendly, lexicographic compare) */

export function todayStr(): string {
  return toStr(new Date());
}

export function toStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseStr(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(s: string, n: number): string {
  const d = parseStr(s);
  d.setDate(d.getDate() + n);
  return toStr(d);
}

export function diffDays(a: string, b: string): number {
  return Math.round((parseStr(b).getTime() - parseStr(a).getTime()) / 86400000);
}

/** Each night of stay: [checkIn, checkOut) */
export function nightsOf(checkIn: string, checkOut: string): string[] {
  const out: string[] = [];
  let cur = checkIn;
  let guard = 0;
  while (cur < checkOut && guard++ < 365) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

/** Iranian weekend = Thursday (4) & Friday (5) */
export function isWeekend(dateStr: string): boolean {
  const dow = parseStr(dateStr).getDay();
  return dow === 4 || dow === 5;
}

export function isValidDateStr(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseStr(s).getTime());
}
