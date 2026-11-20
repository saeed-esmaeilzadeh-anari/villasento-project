/**
 * Seed the bus ticketing domain (Alibaba-style /bus).
 * Idempotent for the bus tables only — touches nothing of VillaSento.
 * Run: bun scripts/seed-bus.ts
 */
import { PrismaClient } from "@prisma/client";
import { BUS_CAPACITY, gregorianShift, isIranianWeekend, tehranTodayStr, type BusType } from "../src/lib/bus";

const db = new PrismaClient();

// ── deterministic RNG ──
function xmur3(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Cities (code, name, province) ──
const CITIES: [string, string, string][] = [
  ["THR", "تهران", "تهران"],
  ["MHD", "مشهد", "خراسان رضوی"],
  ["ESF", "اصفهان", "اصفهان"],
  ["TBZ", "تبریز", "آذربایجان شرقی"],
  ["SYZ", "شیراز", "فارس"],
  ["AHV", "اهواز", "خوزستان"],
  ["RAS", "رشت", "گیلان"],
  ["KRM", "کرمان", "کرمان"],
  ["URM", "ارومیه", "آذربایجان غربی"],
  ["SRY", "ساری", "مازندران"],
];

const TERMINALS: Record<string, string[]> = {
  THR: ["ترمینال جنوب", "ترمینال بیهقی", "ترمینال غرب (آزادگان)"],
  TBZ: ["پایانه مسافربری تبریز"],
  MHD: ["پایانه ملک‌آباد"],
  ESF: ["پایانه مسافربری کاوه", "پایانه صفه"],
  SYZ: ["پایانه مسافربری شیراز"],
  AHV: ["پایانه مسافربری اهواز"],
  RAS: ["پایانه مسافربری لادژان"],
  KRM: ["پایانه مسافربری کرمان"],
  URM: ["پایانه مسافربری ارومیه"],
  SRY: ["پایانه مسافربری ساری"],
};

const COMPANIES: [string, string, number][] = [
  ["همسفر", "#0E9F6E", 4.4],
  ["ایران‌پیما", "#2563EB", 4.1],
  ["سیر و سفر", "#DC2626", 4.6],
  ["رویال سفر", "#7C3AED", 4.8],
  ["گیتی‌پیما", "#EA580C", 4.0],
  ["آریا سفر", "#0891B2", 4.2],
  ["لوکس‌راه", "#DB2777", 4.3],
  ["پیک سفر", "#CA8A04", 3.9],
];

// ── Routes: from, to, km, durationMin, prices per type, daily depart times ──
type RouteDef = { from: string; to: string; duration: number; price: Record<BusType, number>; times: string[] };
const R = (from: string, to: string, duration: number, p: [number, number, number], times: string[]): RouteDef => ({
  from, to, duration, price: { SEATER_2_2: p[0], SEATER_2_1: p[1], BED_2_1: p[2] }, times,
});

const ROUTES: RouteDef[] = [
  R("THR", "TBZ", 470, [550000, 680000, 750000], ["07:00", "09:30", "12:30", "15:00", "18:30", "21:30", "23:30"]),
  R("TBZ", "THR", 470, [550000, 680000, 750000], ["07:30", "10:00", "13:00", "15:30", "19:00", "22:00"]),
  R("THR", "MHD", 720, [950000, 1150000, 1250000], ["06:30", "09:00", "14:00", "17:30", "20:00", "21:30"]),
  R("MHD", "THR", 720, [930000, 1130000, 1230000], ["06:00", "08:30", "13:30", "17:00", "19:30", "21:00"]),
  R("THR", "ESF", 330, [380000, 450000, 520000], ["06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"]),
  R("ESF", "THR", 330, [380000, 450000, 520000], ["06:30", "08:30", "10:30", "12:30", "14:30", "16:30", "18:30", "20:30", "22:30"]),
  R("THR", "SYZ", 730, [950000, 1150000, 1300000], ["07:00", "10:00", "15:00", "19:00", "21:00"]),
  R("SYZ", "THR", 730, [930000, 1130000, 1280000], ["07:30", "10:30", "15:30", "19:30"]),
  R("THR", "AHV", 600, [800000, 950000, 1050000], ["07:30", "10:30", "14:30", "18:30", "21:30"]),
  R("AHV", "THR", 600, [800000, 950000, 1050000], ["08:00", "11:00", "15:00", "19:00"]),
  R("THR", "RAS", 255, [280000, 350000, 420000], ["06:30", "08:30", "10:30", "12:30", "14:30", "16:30", "18:30", "20:30"]),
  R("RAS", "THR", 255, [280000, 350000, 420000], ["07:00", "09:00", "11:00", "13:00", "15:00", "17:00", "19:00", "21:00"]),
  R("THR", "KRM", 780, [1100000, 1300000, 1450000], ["08:00", "15:00", "19:00"]),
  R("KRM", "THR", 780, [1080000, 1280000, 1430000], ["07:30", "14:30", "18:30"]),
  R("THR", "SRY", 210, [220000, 280000, 330000], ["07:00", "09:00", "11:00", "13:00", "15:00", "17:00", "19:00"]),
  R("SRY", "THR", 210, [220000, 280000, 330000], ["06:30", "08:30", "10:30", "12:30", "14:30", "16:30", "18:30"]),
  R("TBZ", "URM", 135, [150000, 190000, 220000], ["07:00", "09:00", "11:00", "13:00", "15:00", "17:00", "19:00", "21:00"]),
  R("URM", "TBZ", 135, [150000, 190000, 220000], ["07:30", "09:30", "11:30", "13:30", "15:30", "17:30", "19:30", "21:30"]),
  R("ESF", "SYZ", 540, [680000, 820000, 900000], ["07:00", "11:00", "16:00", "20:00"]),
  R("SYZ", "ESF", 540, [680000, 820000, 900000], ["07:30", "11:30", "16:30", "20:30"]),
  R("MHD", "ESF", 870, [1200000, 1400000, 1550000], ["08:00", "16:00"]),
  R("ESF", "MHD", 870, [1200000, 1400000, 1550000], ["07:30", "15:30"]),
];

const BUS_TYPE_PLAN: BusType[] = [
  "SEATER_2_2", "SEATER_2_1", "BED_2_1", "SEATER_2_2", "SEATER_2_1", "BED_2_1",
  "SEATER_2_2", "SEATER_2_2", "SEATER_2_1", "BED_2_1", "SEATER_2_1", "BED_2_1",
  "SEATER_2_2", "SEATER_2_2", "SEATER_2_1", "BED_2_1", "SEATER_2_2", "SEATER_2_1",
  "SEATER_2_2", "BED_2_1",
];
const PLATE_LETTERS = ["ع", "ب", "د", "س", "ط", "و", "ه", "ژ"];

async function main() {
  console.log("── Bus seed start ──");

  // reset only bus-domain tables (FK order)
  await db.busTicket.deleteMany();
  await db.busSeatHold.deleteMany();
  await db.busTrip.deleteMany();
  await db.bus.deleteMany();
  await db.busCompany.deleteMany();
  await db.busTerminal.deleteMany();
  await db.busCity.deleteMany();

  // cities + terminals
  const cityId: Record<string, string> = {};
  for (let i = 0; i < CITIES.length; i++) {
    const [code, name, province] = CITIES[i];
    const c = await db.busCity.create({ data: { code, name, province, sort: i } });
    cityId[code] = c.id;
    for (const t of TERMINALS[code]) {
      await db.busTerminal.create({ data: { cityId: c.id, name: t } });
    }
  }
  const terminalsOf: Record<string, string[]> = {};
  for (const t of await db.busTerminal.findMany()) {
    (terminalsOf[t.cityId] ||= []).push(t.id);
  }

  // companies + buses (20 per company → 160 buses ≥ 128 daily departures)
  const busIds: { id: string; type: BusType; companyId: string }[] = [];
  for (const [name, color, rating] of COMPANIES) {
    const comp = await db.busCompany.create({ data: { name, color, rating } });
    for (let i = 0; i < BUS_TYPE_PLAN.length; i++) {
      const type = BUS_TYPE_PLAN[i];
      const letter = PLATE_LETTERS[(COMPANIES.findIndex((c) => c[0] === name) + i) % PLATE_LETTERS.length];
      const plate = `${String(10 + ((i * 7) % 80)).padStart(2, "0")}${letter}${String(100 + ((i * 137) % 900))}`;
      const b = await db.bus.create({
        data: { companyId: comp.id, plate: `${plate}-${String(21 + (i % 7) * 11)}`, type, capacity: BUS_CAPACITY[type] },
      });
      busIds.push({ id: b.id, type, companyId: comp.id });
    }
  }

  const today = tehranTodayStr();
  const DAYS = 45;
  const terminalsByCode: Record<string, string[]> = {};
  for (const [code, id] of Object.entries(cityId)) terminalsByCode[code] = terminalsOf[id];

  type TripRow = {
    fromCityId: string; toCityId: string; fromTerminalId: string; toTerminalId: string;
    companyId: string; busId: string;
    departDate: string; departTime: string; durationMin: number; price: number;
    soldSeats: string; femaleSeats: string;
  };
  const rows: TripRow[] = [];

  // bus allocation: unique bus per (date, time) — probe forward on collision
  const usedAt = new Map<string, Set<number>>(); // `${date}|${time}` -> bus indexes
  const pickBus = (date: string, time: string, want: BusType, rng: () => number): { id: string; type: BusType; companyId: string } => {
    const key = `${date}|${time}`;
    const taken = usedAt.get(key) ?? new Set<number>();
    let start = Math.floor(rng() * busIds.length);
    for (let probe = 0; probe < busIds.length * 2; probe++) {
      const idx = (start + probe) % busIds.length;
      if (taken.has(idx)) continue;
      const bus = busIds[idx];
      // prefer matching type, else any
      if (bus.type === want || probe > busIds.length - 1) {
        taken.add(idx);
        usedAt.set(key, taken);
        return bus;
      }
      if (probe === busIds.length - 1) {
        taken.add(idx);
        usedAt.set(key, taken);
        return bus;
      }
    }
    // fallback (should not happen: 160 buses > 128 departures)
    const bus = busIds[start % busIds.length];
    return bus;
  };

  for (let dayIdx = 0; dayIdx < DAYS; dayIdx++) {
    const gdate = gregorianShift(today, dayIdx);
    const weekend = isIranianWeekend(gdate);
    const daysAhead = dayIdx; // 0 = today

    for (const route of ROUTES) {
      const fromTerms = terminalsByCode[route.from];
      const toTerms = terminalsByCode[route.to];
      for (let tIdx = 0; tIdx < route.times.length; tIdx++) {
        const departTime = route.times[tIdx];
        // deterministic rng per trip
        const seedGen = xmur3(`${route.from}-${route.to}-${gdate}-${departTime}`);
        const rng = mulberry32(seedGen());

        const bus = pickBus(gdate, departTime, BUS_TYPE_PLAN[(tIdx + dayIdx) % BUS_TYPE_PLAN.length], rng);
        const base = route.price[bus.type as BusType] ?? route.price.SEATER_2_2;
        const jitter = 0.92 + rng() * 0.16;
        let price = Math.round((base * (weekend ? 1.15 : 1) * jitter) / 10000) * 10000;

        // load factor grows as departure approaches; evening departures fuller
        const hour = Number(departTime.split(":")[0]);
        const eveningBoost = hour >= 17 ? 0.12 : 0;
        const lfBase = daysAhead <= 2 ? 0.5 : daysAhead <= 7 ? 0.32 : 0.16;
        const lf = Math.min(0.92, lfBase + rng() * 0.35 + eveningBoost);
        const cap = BUS_CAPACITY[bus.type as BusType] ?? 44;
        const soldCount = Math.round(cap * lf);

        // pick distinct sold seats
        const seats = new Set<number>();
        while (seats.size < soldCount) seats.add(1 + Math.floor(rng() * cap));
        const sold = [...seats].sort((a, b) => a - b);
        const female = sold.filter(() => rng() < 0.42);

        rows.push({
          fromCityId: cityId[route.from],
          toCityId: cityId[route.to],
          fromTerminalId: fromTerms[Math.floor(rng() * fromTerms.length)],
          toTerminalId: toTerms[Math.floor(rng() * toTerms.length)],
          companyId: bus.companyId,
          busId: bus.id,
          departDate: gdate,
          departTime,
          durationMin: route.duration,
          price,
          soldSeats: sold.join(","),
          femaleSeats: female.join(","),
        });
      }
    }
  }

  // batch insert
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    await db.busTrip.createMany({ data: rows.slice(i, i + BATCH) });
  }

  const tripCount = await db.busTrip.count();
  console.log(`cities=${CITIES.length} companies=${COMPANIES.length} buses=${busIds.length} trips=${tripCount}`);
  console.log("── Bus seed done ──");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
