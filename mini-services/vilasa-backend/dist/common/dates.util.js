"use strict";
/** Date helpers — everything is stored as "YYYY-MM-DD" strings (SQLite friendly, lexicographic compare). Port of src/server/dates.ts */
Object.defineProperty(exports, "__esModule", { value: true });
exports.todayStr = todayStr;
exports.toStr = toStr;
exports.parseStr = parseStr;
exports.addDays = addDays;
exports.diffDays = diffDays;
exports.nightsOf = nightsOf;
exports.isWeekend = isWeekend;
exports.isValidDateStr = isValidDateStr;
function todayStr() {
    return toStr(new Date());
}
function toStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}
function parseStr(s) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
}
function addDays(s, n) {
    const d = parseStr(s);
    d.setDate(d.getDate() + n);
    return toStr(d);
}
function diffDays(a, b) {
    return Math.round((parseStr(b).getTime() - parseStr(a).getTime()) / 86400000);
}
/** Each night of stay: [checkIn, checkOut) */
function nightsOf(checkIn, checkOut) {
    const out = [];
    let cur = checkIn;
    let guard = 0;
    while (cur < checkOut && guard++ < 365) {
        out.push(cur);
        cur = addDays(cur, 1);
    }
    return out;
}
/** Iranian weekend = Thursday (4) & Friday (5) */
function isWeekend(dateStr) {
    const dow = parseStr(dateStr).getDay();
    return dow === 4 || dow === 5;
}
function isValidDateStr(s) {
    return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseStr(s).getTime());
}
//# sourceMappingURL=dates.util.js.map