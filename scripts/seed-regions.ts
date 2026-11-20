/**
 * VillaSento region seed — hierarchical geographic regions for the
 * جاده سنتو (old Mashhad–Quchan road) corridor and its villages.
 *
 * Coordinate sources (all real, no fabrication):
 *  - OpenStreetMap / Nominatim (research run: scripts/research-geo.ts, 2026-11-20)
 *  - fa.wikipedia.org (ناظریه، رضویه، قوچان pages — administrative placement)
 *  - irangaah.ir village atlas (دهستان attribution cross-check)
 *
 * Regions whose real position could NOT be verified are seeded with
 * geoStatus="UNVERIFIED" and NULL coordinates ("نیازمند بررسی").
 * Idempotent: upserts by nameEn; never deletes existing rows.
 *
 * Run: bun scripts/seed-regions.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

type RegionDef = {
  name: string;
  nameEn: string;
  type: "PROVINCE" | "COUNTY" | "DEHESTAN" | "CITY" | "ROAD" | "VILLAGE" | "AREA";
  altNames?: string[];
  lat?: number;
  lng?: number;
  geoStatus: "VERIFIED" | "UNVERIFIED";
  isFeatured?: boolean;
  description?: string;
  children?: RegionDef[];
};

const TREE: RegionDef = {
  name: "خراسان رضوی",
  nameEn: "razavi-khorasan",
  type: "PROVINCE",
  geoStatus: "UNVERIFIED",
  description: "استان خراسان رضوی؛ محدوده فعالیت ویلاسنتو در شمال‌شرق ایران.",
  children: [
    {
      name: "شهرستان مشهد",
      nameEn: "mashhad-county",
      type: "COUNTY",
      geoStatus: "VERIFIED",
      // reference point = centre of the county seat (شهر مشهد, OSM-verified)
      lat: 36.29749, lng: 59.60592,
      description: "شهرستان مشهد؛ محورهای جاده سنتو (جاده قدیم قوچان) و حاشیه مشهد.",
      children: [
        {
          name: "مشهد",
          nameEn: "mashhad",
          type: "CITY",
          geoStatus: "VERIFIED",
          lat: 36.29749, lng: 59.60592,
          isFeatured: false,
          description: "شهر مشهد، مرکز شهرستان؛ ارتباط با مدل شهر (City) قدیمی سامانه حفظ شده است.",
        },
        {
          name: "جاده سنتو",
          nameEn: "santoo-road",
          type: "ROAD",
          altNames: ["جاده قدیم قوچان", "جاده ۲۲ مشهد-قوچان", "سنتو"],
          geoStatus: "VERIFIED",
          // corridor marker = centroid of its OSM-verified villages (36.466–36.536N, 59.337–59.450E)
          lat: 36.5032, lng: 59.3975,
          isFeatured: true,
          description:
            "جاده سنتو (نام محلی جاده قدیم قوچان، جاده ۲۲ مشهد–قوچان) محور اصلی فعالیت ویلاسنتو است؛ 'قوچان - مشهد (جاده۲۲ یا جاده سنتو)' (ویکی‌پدیا). نقطه نشانه‌گذاری، مرکزیت روستاهای تأییدشده حاشیه جاده است نه یک مکان مشخص.",
          children: [
            {
              name: "دهستان میان ولایت",
              nameEn: "mian-velayat",
              type: "DEHESTAN",
              altNames: ["میان‌ولایت"],
              geoStatus: "VERIFIED",
              // centroid of verified member villages
              lat: 36.5098, lng: 59.3895,
              description: "دهستان میان ولایت، بخش مرکزی شهرستان مشهد — واقع در حاشیه جاده سنتو (جاده قدیم قوچان).",
              children: [
            {
              name: "رضویه",
              nameEn: "razaviyeh",
              type: "VILLAGE",
              altNames: ["قلعه سیاه", "رضویه قلعه سیاه", "قلاسیاه"],
              geoStatus: "VERIFIED",
              lat: 36.48341, lng: 59.41096,
              isFeatured: true,
              description:
                "روستای رضویه (قلعه سیاه) در دهستان میان ولایت، حاشیه جاده سنتو. توجه: با شهر رضویه در بخش رضویه (جنوب‌شرق مشهد، جاده قدیم سرخس) متفاوت است؛ طبق بررسی جغرافیایی، محدوده هدف ویلاسنتو همین روستای جاده سنتو است.",
            },
            {
              name: "ناظریه",
              nameEn: "nazariyeh",
              type: "VILLAGE",
              altNames: ["ناظریه مشهد"],
              geoStatus: "VERIFIED",
              lat: 36.47414, lng: 59.38591,
              isFeatured: true,
              description: "روستای ناظریه در دهستان میان ولایت، حاشیه جاده سنتو (جاده قدیم قوچان).",
            },
            {
              name: "چهارفصل",
              nameEn: "chahar-fasl",
              type: "VILLAGE",
              altNames: ["چهار فصل", "چهارفصل"],
              geoStatus: "VERIFIED",
              lat: 36.47036, lng: 59.41164,
              isFeatured: true,
              description: "روستای چهارفصل در دهستان میان ولایت، حاشیه جاده سنتو؛ از محدوده‌های پرتقاضای باغ و باغ‌ویلا.",
            },
            {
              name: "روح‌آباد",
              nameEn: "ruh-abad",
              type: "VILLAGE",
              altNames: ["روح آباد"],
              geoStatus: "VERIFIED",
              lat: 36.46653, lng: 59.40967,
              description: "روستای روح‌آباد در دهستان میان ولایت، حاشیه جاده سنتو.",
            },
            {
              name: "عشق‌آباد",
              nameEn: "eshgh-abad",
              type: "VILLAGE",
              altNames: ["عشق آباد"],
              geoStatus: "VERIFIED",
              lat: 36.49355, lng: 59.42257,
              description: "روستای عشق‌آباد در دهستان میان ولایت، حاشیه جاده سنتو.",
            },
            {
              name: "عسگریه",
              nameEn: "asgarieh",
              type: "VILLAGE",
              altNames: ["عسکریه"],
              geoStatus: "VERIFIED",
              lat: 36.49875, lng: 59.38494,
              description:
                "روستای عسگریه در دهستان میان ولایت، حاشیه جاده سنتو ('آدرس جاده سنتو عسکریه' در آگهی‌های واقعی). با محله عسگریه داخل شهر مشهد متفاوت است.",
            },
            {
              name: "بازمرگان",
              nameEn: "bazmargan",
              type: "VILLAGE",
              geoStatus: "VERIFIED",
              lat: 36.51604, lng: 59.40473,
              description: "روستای بازمرگان در دهستان میان ولایت (جمعیت سرشماری ۱۳۸۵: ۵۶۹ نفر).",
            },
            {
              name: "سنگ سیاه",
              nameEn: "sang-siah",
              type: "VILLAGE",
              geoStatus: "VERIFIED",
              lat: 36.52282, lng: 59.39076,
              description: "روستای سنگ سیاه در دهستان میان ولایت، شمال حاشیه جاده سنتو.",
            },
            {
              name: "شاهین‌قلعه",
              nameEn: "shahin-ghaleh",
              type: "VILLAGE",
              altNames: ["شاهین قلعه"],
              geoStatus: "VERIFIED",
              lat: 36.50865, lng: 59.37065,
              description: "روستای شاهین‌قلعه در دهستان میان ولایت.",
            },
            {
              name: "ریحان",
              nameEn: "reyhan",
              type: "VILLAGE",
              geoStatus: "VERIFIED",
              lat: 36.52121, lng: 59.40647,
              description: "روستای ریحان در دهستان میان ولایت؛ با بوستان ریحان داخل شهر مشهد متفاوت است.",
            },
            {
              name: "چهچه",
              nameEn: "chehcheh",
              type: "VILLAGE",
              geoStatus: "VERIFIED",
              lat: 36.53175, lng: 59.36996,
              description: "روستای چهچه در دهستان میان ولایت.",
            },
            {
              name: "چنارسوخته",
              nameEn: "chenar-sokhteh",
              type: "VILLAGE",
              altNames: ["چنار سوخته"],
              geoStatus: "VERIFIED",
              lat: 36.53175, lng: 59.33684,
              description: "روستای چنارسوخته در دهستان میان ولایت.",
            },
            {
              name: "دوین",
              nameEn: "dovin",
              type: "VILLAGE",
              geoStatus: "VERIFIED",
              lat: 36.53641, lng: 59.34178,
              description: "روستای دوین در دهستان میان ولایت.",
            },
            {
              name: "شیرحصار",
              nameEn: "shir-hesar",
              type: "VILLAGE",
              geoStatus: "VERIFIED",
              lat: 36.57635, lng: 59.38883,
              description:
                "روستای شیرحصار در دهستان میان ولایت (شمال دهستان). توجه: روستای هم‌نام دیگری در دهستان کنویست جنوب‌شرق مشهد وجود دارد.",
            },
            {
              name: "فیلیان قائم‌مقام",
              nameEn: "feilian-ghaem-magham",
              type: "VILLAGE",
              altNames: ["فیلیان", "فیلیان قائم مقام"],
              geoStatus: "VERIFIED",
              lat: 36.52595, lng: 59.42308,
              description:
                "روستای فیلیان قائم‌مقام در دهستان میان ولایت. جستجوی «فیلیان» هر دو روستای فیلیان (قائم‌مقام و حضرتی) را پیدا می‌کند.",
            },
            {
              name: "فیلیان حضرتی",
              nameEn: "feilian-hezrati",
              type: "VILLAGE",
              altNames: ["فیلیان", "فیلیان حضرتی"],
              geoStatus: "VERIFIED",
              lat: 36.52715, lng: 59.42788,
              description: "روستای فیلیان حضرتی در دهستان میان ولایت — روستایی هم‌نام و جدا از فیلیان قائم‌مقام.",
            },
            {
              name: "امینیه",
              nameEn: "aminiyeh",
              type: "VILLAGE",
              altNames: ["امینیه ۳", "امین"],
              geoStatus: "VERIFIED",
              lat: 36.50474, lng: 59.35213,
              description: "روستای امینیه در دهستان میان ولایت، حاشیه جاده قدیم قوچان ('باغ ویلا امینیه' در آگهی‌های واقعی).",
            },
            {
              name: "خان سعادت",
              nameEn: "khan-saadat",
              type: "VILLAGE",
              geoStatus: "VERIFIED",
              lat: 36.51428, lng: 59.36261,
              description: "روستای خان سعادت در دهستان میان ولایت.",
            },
            {
              name: "خرابه امین",
              nameEn: "kharabeh-amin",
              type: "VILLAGE",
              geoStatus: "UNVERIFIED",
              description:
                "نیازمند بررسی: مکان دقیق «خرابه امین» در منابع معتبر (OSM/ویکی‌پدیا) یافت نشد؛ احتمالاً با روستای امینیه همان مکان است اما تا تأیید، بدون مختصات ثبت شده است.",
            },
          ],
            },
          ],
        },
        {
          name: "احمدآباد مقبل",
          nameEn: "ahmadabad-moghbel",
          type: "VILLAGE",
          geoStatus: "VERIFIED",
          lat: 36.47929, lng: 59.44982,
          description:
            "روستای احمدآباد مقبل — اداری در دهستان طوس، بخش مرکزی شهرستان مشهد؛ در همسایگی شرقی رضویه و حاشیه محور جاده سنتو.",
        },
        {
          name: "قادرآباد",
          nameEn: "ghader-abad",
          type: "VILLAGE",
          geoStatus: "UNVERIFIED",
          description:
            "نیازمند بررسی: روستای قادرآباد در محدوده شهرستان مشهد در منابع معتبر یافت نشد (قادرآبادهای ثبت‌شده در شهرستان‌های دیگر استان هستند). پس از تأیید موقعیت، مختصات ثبت می‌شود.",
        },
        {
          name: "فرح‌آباد",
          nameEn: "farah-abad",
          type: "VILLAGE",
          geoStatus: "UNVERIFIED",
          description:
            "نیازمند بررسی: روستای فرح‌آباد در محدوده جاده سنتو/شهرستان مشهد در OSM و ویکی‌پدیا تأیید نشد. مختصات تا زمان تأیید ثبت نمی‌شود.",
        },
        {
          name: "حسن‌آباد برجی",
          nameEn: "hassanabad-borji",
          type: "VILLAGE",
          geoStatus: "UNVERIFIED",
          description: "نیازمند بررسی: موقعیت جغرافیایی «حسن‌آباد برجی» در منابع معتبر تأیید نشده است.",
        },
        {
          name: "رباطو",
          nameEn: "rabatoo",
          type: "VILLAGE",
          geoStatus: "UNVERIFIED",
          description:
            "نیازمند بررسی: «رباطو» در منابع معتبر به‌عنوان روستای مستقل حاشیه جاده سنتو یافت نشد؛ تنها محله «رباط» داخل شهر مشهد ثبت است که مکان دیگری است.",
        },
        {
          name: "چاه‌مال",
          nameEn: "chah-mal",
          type: "VILLAGE",
          geoStatus: "UNVERIFIED",
          description: "نیازمند بررسی: موقعیت «چاه‌مال» در منابع معتبر تأیید نشده است.",
        },
        {
          name: "کلاته اسماعیل",
          nameEn: "kalateh-esmail",
          type: "VILLAGE",
          geoStatus: "UNVERIFIED",
          description:
            "نیازمند بررسی: «کلاته اسماعیل» در محدوده جاده سنتو تأیید نشد؛ «کلاته حاج اسماعیل» ثبت‌شده در شهرستان گلبهار است (مکان دیگر).",
        },
      ],
    },
  ],
};

let upserted = 0;

async function seedNode(node: RegionDef, parentId: string | null, provinceId: string | null, legacyCityId: string | null): Promise<void> {
  const altNames = (node.altNames ?? []).join("|");
  const data = {
    name: node.name,
    type: node.type,
    altNames,
    lat: node.lat ?? null,
    lng: node.lng ?? null,
    geoStatus: node.geoStatus,
    isFeatured: !!node.isFeatured,
    description: node.description ?? "",
    parentId,
    provinceId,
  };
  const region = await db.region.upsert({
    where: { nameEn: node.nameEn },
    update: data,
    create: { ...data, nameEn: node.nameEn, legacyCityId },
  });
  upserted++;

  // legacy link: شهر مشهد ↔ مدل City قدیمی (برای سازگاری فیلترهای قبلی)
  if (node.nameEn === "mashhad" && legacyCityId && region.legacyCityId !== legacyCityId) {
    await db.region.update({ where: { id: region.id }, data: { legacyCityId } });
  }

  for (const child of node.children ?? []) {
    await seedNode(child, region.id, provinceId ?? region.id, legacyCityId);
  }
}

async function main() {
  console.log("🌱 Seeding Villasento regions (جاده سنتو corridor)…");

  // legacy City "مشهد" (created by scripts/seed.ts) for backward-compatible filters
  const mashhadCity = await db.city.findFirst({ where: { name: "مشهد" }, select: { id: true, name: true } });
  if (!mashhadCity) console.warn("⚠ legacy City «مشهد» not found — legacy link skipped");
  else console.log(`   legacy city link: مشهد → ${mashhadCity.id}`);

  await seedNode(TREE, null, null, mashhadCity?.id ?? null);

  const [total, verified, featured, unverified] = await Promise.all([
    db.region.count(),
    db.region.count({ where: { geoStatus: "VERIFIED" } }),
    db.region.count({ where: { isFeatured: true, isActive: true } }),
    db.region.findMany({ where: { geoStatus: "UNVERIFIED" }, select: { name: true } }),
  ]);

  console.log("✅ Region seed complete:");
  console.log(`   Regions: ${total} (upserted: ${upserted}) | VERIFIED with real coords: ${verified}`);
  console.log(`   Featured (main regions): ${featured}`);
  console.log(`   نیازمند بررسی (no coords): ${unverified.map((r) => r.name).join("، ")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
