/**
 * VillaSento seed — realistic demo data for the real-estate platform
 * خرید و فروش، رهن و اجاره باغ، ویلا، باغ‌ویلا و املاک تفریحی و مسکونی
 * Run: bun scripts/seed.ts
 */
import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "crypto";

const db = new PrismaClient();

/** scrypt password hash (matches server/services/auth password logic) */
function hashPassword(plain: string): string {
  const saltHex = randomBytes(16).toString("hex");
  const hash = scryptSync(plain, Buffer.from(saltHex, "hex"), 64, { N: 16384, r: 8, p: 1 }).toString("hex");
  return `scrypt$${saltHex}$${hash}`;
}

const DEMO_PASSWORD = "123456";

const d = (offset: number) => {
  const dt = new Date();
  dt.setDate(dt.getDate() + offset);
  return dt.toISOString().slice(0, 10);
};
const dt = (offsetDays: number, hour = 12) => {
  const x = new Date();
  x.setDate(x.getDate() + offsetDays);
  x.setHours(hour, 0, 0, 0);
  return x;
};

function code(prefix = "VS") {
  return prefix + "-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function main() {
  console.log("🌱 Seeding VillaSento…");

  // ── wipe in dependency order (legacy tables included for a clean slate) ──
  await db.auditLog.deleteMany();
  await db.notification.deleteMany();
  await db.message.deleteMany();
  await db.conversation.deleteMany();
  await db.couponUsage.deleteMany();
  await db.refund.deleteMany();
  await db.payment.deleteMany();
  await db.bookingEvent.deleteMany();
  await db.booking.deleteMany();
  await db.review.deleteMany();
  await db.favorite.deleteMany();
  await db.calendarDay.deleteMany();
  await db.propertyView.deleteMany();
  await db.visitRequestEvent.deleteMany();
  await db.visitRequest.deleteMany();
  await db.contactMessage.deleteMany();
  await db.propertyAmenity.deleteMany();
  await db.propertyImage.deleteMany();
  await db.property.deleteMany();
  await db.payout.deleteMany();
  await db.complaint.deleteMany();
  await db.coupon.deleteMany();
  await db.amenity.deleteMany();
  await db.faq.deleteMany();
  await db.banner.deleteMany();
  await db.article.deleteMany();
  await db.articleCategory.deleteMany();
  await db.agentProfile.deleteMany();
  await db.area.deleteMany();
  await db.city.deleteMany();
  await db.province.deleteMany();
  await db.otpCode.deleteMany();
  await db.cmsPage.deleteMany();
  await db.systemSetting.deleteMany();
  await db.user.deleteMany();

  const pw = hashPassword(DEMO_PASSWORD);

  // ── Users ──
  const superAdmin = await db.user.create({ data: { phone: "09120000001", fullName: "مدیر ارشد سامانه", role: "SUPER_ADMIN", isHostVerified: true, passwordHash: pw } });
  const admin2 = await db.user.create({ data: { phone: "09120000006", fullName: "پشتیبان محتوا", role: "ADMIN", passwordHash: pw } });

  const agent1 = await db.user.create({ data: { phone: "09120000002", fullName: "محمود احمدی", role: "AGENT", isHostVerified: true, passwordHash: pw } });
  const agent2 = await db.user.create({ data: { phone: "09120000003", fullName: "فاطمه رضایی", role: "AGENT", isHostVerified: true, passwordHash: pw } });
  const agent3 = await db.user.create({ data: { phone: "09120000004", fullName: "علی کریمی", role: "AGENT", isHostVerified: true, passwordHash: pw } });
  await db.agentProfile.createMany({
    data: [
      { userId: agent1.id, agencyName: "املاک احمدی و شرکا", bio: "۱۲ سال سابقه فروش باغ و ویلا در شمال تهران و لواسان", licenseNo: "A-24518", phone2: "021-22334455" },
      { userId: agent2.id, agencyName: "مشاورین املاک رضایی", bio: "متخصص رهن و اجاره املاک لوکس مسکونی", licenseNo: "A-33720" },
      { userId: agent3.id, agencyName: "کریمی پارسیان", bio: "بازار املاک تفریحی مازندران و البرز", licenseNo: "A-41093" },
    ],
  });

  const owner1 = await db.user.create({ data: { phone: "09120000005", fullName: "مریم موسوی", role: "OWNER", isHostVerified: true, passwordHash: pw, nationalId: "0079123456" } });
  const owner2 = await db.user.create({ data: { phone: "09120000007", fullName: "حسین نادری", role: "OWNER", passwordHash: pw } });
  const cust1 = await db.user.create({ data: { phone: "09123456789", fullName: "سارا محمدی", role: "CUSTOMER", passwordHash: pw } });
  const cust2 = await db.user.create({ data: { phone: "09351112233", fullName: "رضا قاسمی", role: "CUSTOMER", passwordHash: pw } });
  const cust3 = await db.user.create({ data: { phone: "09197778899", fullName: "نگار سلطانی", role: "CUSTOMER", passwordHash: pw } });

  // ── Locations + Areas ──
  const provincesData: [string, [string, string[]][]][] = [
    ["تهران", [
      ["تهران", ["سعادت‌آباد", "شهرک غرب", "زعفرانیه", "درکه", "پیروزی"]],
      ["لواسان", ["لواسان بزرگ", "افجه", "میگون"]],
      ["فیروزکوه", ["مرکز شهر", "شادیان"]],
      ["طالقان", ["مرکز شهر", "بروجان"]],
    ]],
    ["مازندران", [
      ["نوشهر", ["مرکز شهر", "مرزن‌آباد"]],
      ["چالوس", ["نمک‌آبرود", "مرکز شهر"]],
      ["کلارآباد", ["بلوار دریا"]],
    ]],
    ["گیلان", [
      ["فومن", ["مرکز شهر", "ماسوله"]],
      ["لاهیجان", ["مرکز شهر"]],
    ]],
    ["البرز", [
      ["کرج", ["گوهردشت", "مهرشهر", "عظیمیه"]],
      ["اشتهارد", ["مرکز شهر"]],
    ]],
    ["اصفهان", [
      ["کاشان", ["قمصر", "فین"]],
      ["اصفهان", ["مرداویج", "سپاهان‌شهر"]],
    ]],
    ["فارس", [
      ["شیراز", ["معالی‌دشت", "قصرالدشت"]],
    ]],
    ["خراسان رضوی", [
      ["مشهد", ["احمدآباد", "وکیل‌آباد"]],
      ["شاندیز", ["مرکز شهر"]],
    ]],
  ];
  const cityMap = new Map<string, { id: string; areaIds: string[] }>();
  for (const [pname, cities] of provincesData) {
    const p = await db.province.create({ data: { name: pname } });
    for (const [cname, areas] of cities) {
      const city = await db.city.create({ data: { name: cname, provinceId: p.id } });
      const areaIds: string[] = [];
      for (let i = 0; i < areas.length; i++) {
        const a = await db.area.create({ data: { name: areas[i], cityId: city.id, sort: i } });
        areaIds.push(a.id);
      }
      cityMap.set(cname, { id: city.id, areaIds });
    }
  }

  // ── Amenities (real-estate features) ──
  const amenityDefs: [string, string, string][] = [
    ["pool", "استخر", "Waves"], ["jacuzzi", "جکوزی", "Droplets"], ["parking", "پارکینگ", "Car"],
    ["garden", "باغ و محوطه سبز", "TreePine"], ["bbq", "آلاچیق و باربیکیو", "Flame"], ["security", "نگهبانی و دوربین", "ShieldCheck"],
    ["furnished", "مبله", "Sofa"], ["elevator", "آسانسور", "MoveVertical"], ["warehouse", "انباری", "Package"],
    ["balcony", "بالکن / تراس", "LayoutPanelTop"], ["sport", "فضای ورزشی", "Dumbbell"], ["kids", "فضای بازی کودکان", "Baby"],
    ["central_ac", "تهویه مطبوع مرکزی", "AirVent"], ["heating", "سیستم گرمایشی", "FlameKindling"],
    ["well", "چاه آب و آبیاری", "Droplet"], ["wall", "دیوارکشی و درب برقی", "Fence"],
  ];
  const amenities = new Map<string, string>();
  for (const [key, name, icon] of amenityDefs) {
    const a = await db.amenity.create({ data: { key, name, icon } });
    amenities.set(key, a.id);
  }

  // ── Properties ──
  type P = {
    host: string; agent?: string; title: string; type: string; tt: string; city: string; areaIdx?: number;
    address: string; desc: string; land?: number; build?: number; bedrooms?: number; baths?: number;
    floors?: number; year?: number; doc?: string; sale?: number; rahn?: number; rent?: number;
    negotiable?: boolean; terms?: string; images: string[]; amenKeys: string[]; extra?: string;
    featured?: boolean; status?: string; lat?: number; lng?: number; views?: number; video?: string; tour?: string; publishedAt?: Date; expiresAt?: Date;
    rejectReason?: string; contactName?: string; contactPhone?: string; contactPref?: string;
  };
  const IMG = (n: string) => `/villas/${n}.jpg`;
  const properties: P[] = [
    {
      host: owner1.id, agent: agent1.id, title: "باغ‌ویلای لوکس ۷۵۰ متری لواسان با استخر سرپوشیده", type: "GARDEN_VILLA", tt: "SALE",
      city: "لواسان", areaIdx: 0, address: "لواسان بزرگ، بلوار گلستان، کوچه بهاری، پلاک ۱۲",
      desc: "باغ‌ویلای دوبلکس لوکس با استخر سرپوشیده، جکوزی و آلاچیق باربیکیو در بهترین نقطه لواسان.\n\nسند تک‌برگ شش‌دانگ، برق سه‌فاز، گرمایش از کف و نورپردازی محوطه. ساختمان اصلی ۲۶۰ متر در دو طبقه شامل ۴ خواب، ۳ سرویس French و آشپزخانه اپن مجهز.\n\nمناسب سکونت دائم یا سرمایه‌گذاری؛ دسترسی ۲۰ دقیقه‌ای به تهران‌پارس.",
      land: 750, build: 260, bedrooms: 4, baths: 3, floors: 2, year: 1400, doc: "SINGLE_SHEET",
      sale: 12500000000, negotiable: true, terms: "حداقل ۴۰٪ نقد، مابقی تا ۶ ماه",
      images: [IMG("villa1"), IMG("pool1"), IMG("int1"), IMG("int2")],
      amenKeys: ["pool", "jacuzzi", "parking", "garden", "bbq", "security", "heating", "well", "wall"],
      extra: "برق سه‌فاز,گرمایش از کف,نورپردازی محوطه",
      featured: true, lat: 35.6892, lng: 51.8524, views: 812, tour: "https://example.com/tour/lavasan-royal",
      contactName: "محمود احمدی", contactPhone: "09120000002",
    },
    {
      host: owner2.id, agent: agent3.id, title: "ویلای ساحلی دوبلکس نمک‌آبرود، ۱۲۰ متر از دریا", type: "VILLA", tt: "SALE",
      city: "چالوس", areaIdx: 0, address: "نمک‌آبرود، بلوار ساحلی، فرعی ۱۴",
      desc: "ویلای دوبلکس مدرن در کمپ نمک‌آبرود با چشم‌انداز دریا از تراس طبقه دوم.\n\n۱۲۰ متر زیربنا در ۲ طبقه، ۳ خواب، ۲ سرویس، آشپزخانه اپن. محوطه ۴۰۰ متری با درختان سرو و نارون و آلاچیق چوبی.\n\nسند شش‌دانگ تک‌برگ و آماده انتقال.",
      land: 400, build: 120, bedrooms: 3, baths: 2, floors: 2, year: 1398, doc: "SIX_DANG",
      sale: 7800000000, images: [IMG("villa5"), IMG("pool1"), IMG("villa6")],
      amenKeys: ["parking", "garden", "bbq", "furnished", "balcony"],
      lat: 36.6392, lng: 51.4832, views: 534,
      contactName: "علی کریمی", contactPhone: "09120000004",
    },
    {
      host: owner1.id, agent: agent2.id, title: "آپارتمان ۱۴۰ متری سعادت‌آباد، رهن کامل", type: "APARTMENT", tt: "RAHN",
      city: "تهران", areaIdx: 0, address: "سعادت‌آباد، بلوار دریا، مجتمع اقاقیا، طبقه ۴",
      desc: "آپارتمان نوساز ۱۴۰ متری با لابی مجلل و پارکینگ سندی.\n\nکامل تخلیه و آماده تحویل؛ کابینت هایگلاس، پکیج و رادیاتور، کولر گازی اینورتر.\n\nرهن کامل با امکان توافق در پرداخت.",
      land: undefined, build: 140, bedrooms: 3, baths: 2, floors: 1, year: 1401, doc: "SIX_DANG",
      rahn: 2500000000, negotiable: true, images: [IMG("int1"), IMG("int2"), IMG("suite1")],
      amenKeys: ["parking", "elevator", "warehouse", "balcony", "furnished", "central_ac", "security"],
      extra: "لابی من,پارکینگ سندی",
      views: 421,
      contactName: "فاطمه رضایی", contactPhone: "09120000003",
    },
    {
      host: owner2.id, agent: agent3.id, title: "باغ‌ویلای ۵۰۰ متری مهرشهر کرج، رهن و اجاره", type: "GARDEN_VILLA", tt: "RAHN_RENT",
      city: "کرج", areaIdx: 1, address: "مهرشهر، بلوار ارم، کوچه گلستان",
      desc: "باغ‌ویلای دوبلکس در محوطه ۵۰۰ متری با استخر فصلی و آلاچیق.\n\nرهن ۳۰۰ میلیون + اجاره ماهانه ۱۵ میلیون تومان. مناسب خانواده‌های پنج‌نفره و بالاتر.",
      land: 500, build: 180, bedrooms: 3, baths: 2, floors: 2, year: 1395, doc: "SIX_DANG",
      rahn: 300000000, rent: 15000000, images: [IMG("villa2"), IMG("villa6"), IMG("pool1")],
      amenKeys: ["pool", "parking", "garden", "bbq", "heating", "wall"],
      views: 289,
      contactName: "علی کریمی", contactPhone: "09120000004",
    },
    {
      host: owner1.id, agent: agent2.id, title: "خانه ویلایی مبله شهرک غرب، اجاره ماهانه", type: "HOUSE", tt: "RENT",
      city: "تهران", areaIdx: 1, address: "شهرک غرب، فاز ۲، خیابان گلستان",
      desc: "خانه ویلایی ۲۲۰ متری با حیاط اختصاصی در فاز ۲ شهرک غرب.\n\nکامل مبله با امکانات کامل خانگی؛ مناسب خانواده و اقامت بلندمدت. اجاره ماهانه ۴۵ میلیون توافقی.",
      land: 320, build: 220, bedrooms: 3, baths: 2, floors: 1, year: 1389, doc: "SIX_DANG",
      rent: 45000000, negotiable: true, images: [IMG("int1"), IMG("int2"), IMG("villa7")],
      amenKeys: ["parking", "garden", "furnished", "heating", "warehouse"],
      views: 367,
      contactName: "فاطمه رضایی", contactPhone: "09120000003",
    },
    {
      host: owner2.id, agent: agent1.id, title: "باغ ۲۰۰۰ متری با ویلا در مسیر ماسوله فومن", type: "GARDEN", tt: "SALE",
      city: "فومن", areaIdx: 1, address: "ماسوله‌رود، کیلومتر ۳، جنب پمپ بنزین",
      desc: "باغ کامل با درختان فندق و کیوی و ویلای چوبی ۸۰ متری داخل باغ.\n\nآب چشمه دائمی، برق روستایی و جاده آسفالته تا درب باغ. سند تک‌برگ.",
      land: 2000, build: 80, bedrooms: 2, baths: 1, floors: 1, year: 1392, doc: "SINGLE_SHEET",
      sale: 3900000000, images: [IMG("villa3"), IMG("villa7")],
      amenKeys: ["garden", "well", "wall", "parking", "bbq"],
      views: 198, lat: 37.2196, lng: 49.7013,
      contactName: "محمود احمدی", contactPhone: "09120000002",
    },
    {
      host: owner1.id, agent: agent1.id, title: "زمین ۱۰۰۰ متری کلنگی قمصر کاشان", type: "LAND", tt: "SALE",
      city: "کاشان", areaIdx: 0, address: "قمصر، بلوار امام رضا، نرسیده به میدان",
      desc: "زمین کلنگی در بافت مسکونی قمصر با بر و برق و گاز روی زمین.\n\nدسترسی آسفالته، مجوز ساخت تا ۶۰٪ سطح زمین. مناسب ساخت ویلا یا خانه مسکونی.",
      land: 1000, doc: "SIX_DANG", sale: 2100000000,
      images: [IMG("villa4")], amenKeys: ["wall"],
      views: 143,
      contactName: "محمود احمدی", contactPhone: "09120000002",
    },
    {
      host: owner2.id, agent: agent3.id, title: "ویلای کوهپایه‌ای شاندیز با چشم‌انداز بینالود", type: "VILLA", tt: "RENT",
      city: "شاندیز", areaIdx: 0, address: "شاندیز، ابتدای جاده آبشار",
      desc: "ویلای دوبلکس با چشم‌انداز کوهستان بینالود، آلاچیق بزرگ و محوطه چمن‌کاری‌شده.\n\nاجاره ماهانه برای اقامت‌های بلندمدت؛ نزدیک به رستوران‌های شاندیز.",
      land: 350, build: 150, bedrooms: 3, baths: 2, floors: 2, year: 1396, doc: "SIX_DANG",
      rent: 28000000, images: [IMG("villa4"), IMG("villa6"), IMG("int1")],
      amenKeys: ["parking", "garden", "bbq", "heating", "furnished"],
      views: 176,
      contactName: "علی کریمی", contactPhone: "09120000004",
    },
    {
      host: owner2.id, agent: agent1.id, title: "باغ‌ویلای نارنج معالی‌دشت شیراز با استخر سه‌متزه", type: "GARDEN_VILLA", tt: "SALE",
      city: "شیراز", areaIdx: 0, address: "معالی‌دشت، باغ‌های نارنج، ردیف ۵",
      desc: "باغ‌ویلای بزرگ با استخر سه‌متزه، باغ نارنج و پرتقال و آلاچیق ۲۰ نفره؛ مناسب مراسم خانوادگی و سرمایه‌گذاری.",
      land: 900, build: 300, bedrooms: 4, baths: 3, floors: 2, year: 1399, doc: "SINGLE_SHEET",
      sale: 9400000000, images: [IMG("villa4"), IMG("int1"), IMG("int2")],
      amenKeys: ["pool", "parking", "garden", "bbq", "central_ac", "security", "kids"],
      status: "PENDING", views: 0,
      contactName: "محمود احمدی", contactPhone: "09120000002",
    },
    {
      host: owner1.id, agent: agent2.id, title: "آپارتمان ۹۵ متری وکیل‌آباد مشهد، رهن و اجاره", type: "APARTMENT", tt: "RAHN_RENT",
      city: "مشهد", areaIdx: 1, address: "وکیل‌آباد، بین بلوار نبشت",
      desc: "آپارتمان تمیز ۹۵ متری در برج مسکونی وکیل‌آباد با آسانسور و انباری.\n\nرهن ۱۵۰ میلیون + اجاره ۸ میلیون ماهانه.",
      build: 95, bedrooms: 2, baths: 1, floors: 1, year: 1397, doc: "SIX_DANG",
      rahn: 150000000, rent: 8000000, images: [IMG("suite1"), IMG("int2")],
      amenKeys: ["parking", "elevator", "warehouse", "balcony"],
      status: "PENDING", views: 0,
      contactName: "فاطمه رضایی", contactPhone: "09120000003",
    },
    {
      host: owner1.id, title: "ویلای در حال ساخت طالقان (پیش‌نویس)", type: "VILLA", tt: "SALE",
      city: "طالقان", areaIdx: 0, address: "طالقان، بروجان",
      desc: "پیش‌نویس آگهی — اطلاعات مالی تکمیل نشده است.",
      land: 600, build: 100, doc: "WATHIQI",
      images: [IMG("villa7")], amenKeys: [],
      status: "DRAFT", views: 0,
    },
    {
      host: owner2.id, agent: agent3.id, title: "باغ‌ویلای افجه لواسان، اجاره ماهانه", type: "GARDEN_VILLA", tt: "RENT",
      city: "لواسان", areaIdx: 1, address: "افجه، انتهای جاده اصلی",
      desc: "باغ‌ویلای دنج با محوطه ۴۰۰ متری در افجه؛ اجاره ماهانه با امکان تمدید.",
      land: 400, build: 140, bedrooms: 2, baths: 1, floors: 1, year: 1390, doc: "SIX_DANG",
      rent: 35000000, images: [IMG("villa6"), IMG("pool1")],
      amenKeys: ["parking", "garden", "bbq"],
      status: "EXPIRED", views: 233, publishedAt: dt(-75), expiresAt: dt(-15),
      contactName: "علی کریمی", contactPhone: "09120000004",
    },
    {
      host: owner2.id, title: "خانه ویلایی لاهیجان با سند واثقی", type: "HOUSE", tt: "SALE",
      city: "لاهیجان", areaIdx: 0, address: "لاهیجان، خیابان فردوسی",
      desc: "خانه ویلایی ۱۸۰ متری با حیاط مرکزی؛ قیمت پایین‌تر از منطقه به دلیل نوع سند.",
      land: 250, build: 180, bedrooms: 3, baths: 1, floors: 1, year: 1375, doc: "WATHIQI",
      sale: 2900000000, images: [IMG("villa3")],
      amenKeys: ["garden", "parking"],
      status: "REJECTED", rejectReason: "تصاویر ارسالی با آدرس اعلامی مطابقت ندارد؛ لطفاً تصاویر واضح و جدید ارائه دهید.",
      views: 0,
    },
    {
      host: owner1.id, agent: agent1.id, title: "باغ‌ویلای رویال درانتشار تهران، پیشنهاد ویژه", type: "GARDEN_VILLA", tt: "SALE",
      city: "لواسان", areaIdx: 2, address: "درانتشار، انتهای بلوار اصلی",
      desc: "باغ‌ویلای درانتشار با استخر بی‌نهایت، سینمای خانگی و زمین والیبال؛ گزینه‌ای بی‌نظیر برای سرمایه‌گذاری لوکس.",
      land: 1200, build: 420, bedrooms: 5, baths: 4, floors: 2, year: 1402, doc: "SINGLE_SHEET",
      sale: 18500000000, negotiable: false,
      images: [IMG("villa1"), IMG("villa5"), IMG("pool1"), IMG("int1"), IMG("int2")],
      amenKeys: ["pool", "jacuzzi", "parking", "garden", "bbq", "security", "central_ac", "well", "wall", "sport"],
      extra: "سینمای خانگی,استخر بی‌نهایت,زمین والیبال",
      featured: true, lat: 35.7612, lng: 51.7564, views: 967, video: "https://example.com/video/daran.mp4",
      contactName: "محمود احمدی", contactPhone: "09120000002", contactPref: "BOTH",
    },
  ];

  const propIds: string[] = [];
  for (const p of properties) {
    const loc = cityMap.get(p.city)!;
    const areaId = p.areaIdx != null ? loc.areaIds[p.areaIdx] : undefined;
    const status = p.status ?? "PUBLISHED";
    const prop = await db.property.create({
      data: {
        code: code(), hostId: p.host, agentId: p.agent,
        title: p.title, type: p.type, transactionType: p.tt,
        cityId: loc.id, areaId, address: p.address,
        lat: p.lat, lng: p.lng,
        description: p.desc,
        landArea: p.land, buildArea: p.build,
        bedrooms: p.bedrooms ?? 0, bathrooms: p.baths ?? 1, floors: p.floors ?? 1,
        buildYear: p.year, documentStatus: p.doc ?? "MALIKI",
        salePrice: p.sale, rahnAmount: p.rahn, rentAmount: p.rent,
        negotiable: !!p.negotiable, paymentTerms: p.terms,
        videoUrl: p.video, tourUrl: p.tour,
        contactName: p.contactName ?? null, contactPhone: p.contactPhone ?? null,
        contactPreference: p.contactPref ?? "CALL",
        amenitiesExtra: p.extra ?? "",
        status, isFeatured: !!p.featured,
        rejectionReason: p.rejectReason ?? null,
        publishedAt: status === "PUBLISHED" ? dt(-Math.floor(Math.random() * 40) - 2) : status === "EXPIRED" ? (p as { publishedAt?: Date }).publishedAt ?? dt(-75) : null,
        expiresAt: status === "PUBLISHED" ? dt(60) : status === "EXPIRED" ? dt(-15) : null,
        viewCount: p.views ?? 0,
        images: { create: p.images.map((url, i) => ({ url, sort: i })) },
        amenities: { create: p.amenKeys.map((k) => ({ amenityId: amenities.get(k)! })) },
      },
    });
    propIds.push(prop.id);
  }

  // ── PropertyViews (daily stats for charts) ──
  for (let i = 0; i < propIds.length; i++) {
    const base = [12, 8, 6, 5, 7, 4, 3, 5, 0, 0, 0, 9, 0, 15][i] ?? 3;
    for (let day = 29; day >= 0; day--) {
      const cnt = Math.max(0, Math.round(base * (0.4 + Math.random() * 1.3)));
      for (let k = 0; k < cnt; k++) {
        await db.propertyView.create({
          data: { propertyId: propIds[i], day: d(-day), ip: "10.0.0." + (k % 250), userAgent: "seed" },
        });
      }
    }
  }

  // ── Visit requests (with events) ──
  const mkVisit = async (o: {
    prop: string; user?: string; name: string; phone: string; status: string;
    daysAgo: number; preferredIn?: number; assignedTo?: string; note?: string; adminNote?: string;
    events?: { type: string; toStatus?: string; message?: string; daysAfter: number }[];
  }) => {
    const v = await db.visitRequest.create({
      data: {
        code: code("VR"), propertyId: o.prop, userId: o.user ?? null,
        name: o.name, phone: o.phone, note: o.note ?? null,
        preferredAt: o.preferredIn != null ? dt(o.preferredIn, 17) : null,
        status: o.status, assignedToId: o.assignedTo ?? null, adminNote: o.adminNote ?? null,
        createdAt: dt(-o.daysAgo, 10),
      },
    });
    await db.visitRequestEvent.create({ data: { visitRequestId: v.id, type: "CREATED", toStatus: "NEW", createdAt: dt(-o.daysAgo, 10) } });
    for (const ev of o.events ?? []) {
      await db.visitRequestEvent.create({
        data: {
          visitRequestId: v.id, type: ev.type, toStatus: ev.toStatus, message: ev.message,
          createdAt: dt(-o.daysAgo + ev.daysAfter, 14),
        },
      });
    }
    return v;
  };

  await mkVisit({ prop: propIds[0], user: cust1.id, name: "سارا محمدی", phone: "09123456789", status: "DONE", daysAgo: 6, preferredIn: -3, assignedTo: agent1.id, note: "لطفاً بعدازظهر تماس بگیرید", events: [{ type: "ASSIGN", daysAfter: 0, message: "تخصیص به مشاور احمدی" }, { type: "STATUS_CHANGED", toStatus: "IN_PROGRESS", daysAfter: 1 }, { type: "STATUS_CHANGED", toStatus: "DONE", message: "بازدید انجام شد؛ متقاضی به قیمت علاقه‌مند بود", daysAfter: 3 }] });
  await mkVisit({ prop: propIds[1], user: cust2.id, name: "رضا قاسمی", phone: "09351112233", status: "IN_PROGRESS", daysAgo: 2, preferredIn: 2, assignedTo: agent3.id, events: [{ type: "ASSIGN", daysAfter: 0 }] });
  await mkVisit({ prop: propIds[2], user: cust3.id, name: "نگار سلطانی", phone: "09197778899", status: "NEW", daysAgo: 0, preferredIn: 3, note: "فقط رهن کامل بدون اجاره" });
  await mkVisit({ prop: propIds[3], name: "محمد حیدری", phone: "09121234567", status: "NEW", daysAgo: 1, preferredIn: 4 });
  await mkVisit({ prop: propIds[4], user: cust1.id, name: "سارا محمدی", phone: "09123456789", status: "CANCELLED", daysAgo: 9, preferredIn: -5, adminNote: "متقاضی انصراف داد", events: [{ type: "STATUS_CHANGED", toStatus: "CANCELLED", message: "انصراف متقاضی", daysAfter: 1 }] });

  // ── Contact messages ──
  await db.contactMessage.createMany({
    data: [
      { name: "مهسا توکلی", phone: "09361112244", subject: "مشاوره خرید باغ‌ویلا", body: "سلام، بودجه حدود ۱۰ میلیارد دارم؛ در لواسان یا اشتهارد گزینه دارید؟", status: "NEW", propertyId: propIds[0] },
      { name: "امیر صادقی", phone: "09195556677", subject: "استعلام سند", body: "سند ملک نمک‌آبرود تک‌برگ است؟", status: "IN_PROGRESS", propertyId: propIds[1], adminNote: "با مشاور کریمی هماهنگ شد" },
      { name: "زهرا کاظمی", phone: "09127778811", body: "برای ثبت آگهی در ویلاسنتو چه مدارکی لازم است؟", status: "DONE", adminNote: "راهنمایی شد" },
    ],
  });

  // ── Listing report + support complaint ──
  await db.complaint.createMany({
    data: [
      { userId: cust2.id, type: "LISTING_REPORT", propertyId: propIds[4], subject: "گزارش آگهی نامعتبر", body: "قیمت اعلامی با قیمت اعلام‌شده تلفنی تفاوت دارد.", status: "OPEN" },
      { userId: cust3.id, type: "SUPPORT", subject: "مشکل در ورود به حساب", body: "کد تأیید پیامک نمی‌شود.", status: "IN_PROGRESS" },
    ],
  });

  // ── Favorites ──
  await db.favorite.createMany({
    data: [
      { userId: cust1.id, propertyId: propIds[1] },
      { userId: cust1.id, propertyId: propIds[13] },
      { userId: cust2.id, propertyId: propIds[0] },
      { userId: cust2.id, propertyId: propIds[2] },
    ],
  });

  // ── Conversation ──
  const conv = await db.conversation.create({ data: { propertyId: propIds[0], hostId: owner1.id, customerId: cust1.id } });
  await db.message.createMany({
    data: [
      { conversationId: conv.id, senderId: cust1.id, text: "سلام، امکان بازدید پنجشنبه ساعت ۱۶ هست؟" },
      { conversationId: conv.id, senderId: owner1.id, text: "سلام وقت بخیر؛ بله با هماهنگی مشاور محترم امکان‌پذیر است." },
    ],
  });

  // ── Notifications ──
  await db.notification.createMany({
    data: [
      { userId: owner2.id, type: "LISTING", title: "آگهی شما منتشر شد", body: "آگهی «ویلای ساحلی دوبلکس نمک‌آبرود» تأیید و منتشر شد.", link: "#/account/listings" },
      { userId: owner1.id, type: "VISIT", title: "درخواست بازدید جدید", body: "برای «باغ‌ویلای لوکس ۷۵۰ متری لواسان» درخواست بازدید جدید ثبت شد.", link: "#/account/visits" },
      { userId: superAdmin.id, type: "SYSTEM", title: "آگهی در انتظار بررسی", body: "۲ آگهی جدید در انتظار تأیید مدیر است.", link: "#/admin/listings?status=PENDING" },
    ],
  });

  // ── Article categories + articles ──
  const catBuy = await db.articleCategory.create({ data: { name: "راهنمای خرید", slug: "buy-guide", sort: 1 } });
  const catRent = await db.articleCategory.create({ data: { name: "رهن و اجاره", slug: "rent-guide", sort: 2 } });
  const catLaw = await db.articleCategory.create({ data: { name: "قوانین و سند", slug: "legal", sort: 3 } });

  await db.article.createMany({
    data: [
      {
        title: "چک‌لیست کامل خرید باغ‌ویلا در حومه تهران", slug: "garden-villa-buying-checklist",
        excerpt: "از بررسی سند و کاربری زمین تا هزینه‌های پنهان نگهداری؛ همه‌چیز که پیش از خرید باغ‌ویلا باید بدانید.",
        content: "خرید باغ‌ویلا یکی از بزرگ‌ترین سرمایه‌گذاری‌های زندگی است و یک چک‌لیست دقیق می‌تواند از ضررهای میلیون‌ها تومانی جلوگیری کند.\n\n## ۱. بررسی سند و کاربری\nابتدا مطمئن شوید سند از نوع تک‌برگ یا منگوله‌دار معتبر است و کاربری زمین «مسکونی» یا «باغ‌ویلا» باشد. کاربری «زراعی» ممکن است ساخت‌وساز را محدود کند.\n\n## ۲. استعلام‌های ثبتی\nاز اداره ثبت اسناد استعلام بگیرید تا از آزاد بودن ملک (نبود بازداشت یا رهن) مطمئن شوید.\n\n## ۳. بازدید فنی\nسیستم آب، برق سه‌فاز، فاضلاب و وضعیت سازه را با یک مهندس ناظر بررسی کنید.\n\n## ۴. هزینه‌های نگهداری\nسرقفلی نگهبانی، آب‌پاشی محوطه و تعمیرات دوره‌ای را در بودجه ببینید.\n\nدر ویلاسنتو می‌توانید آگهی‌های تأییدشده با مشخصات کامل سند را مقایسه کنید و پیش از بازدید حضوری، با مشاور معتمد صحبت کنید.",
        coverUrl: IMG("villa2"), categoryId: catBuy.id, authorId: admin2.id, tags: "باغ‌ویلا,خرید,چک‌لیست", viewCount: 342, isPublished: true, publishedAt: dt(-12),
      },
      {
        title: "رهن کامل یا رهن و اجاره؟ راهنمای انتخاب هوشمندانه", slug: "rahn-vs-rahn-rent",
        excerpt: "مقایسه رهن کامل با ترکیب رهن و اجاره از نگاه نرخ بهره بانکی و قدرت نقدینگی.",
        content: "در بازار اجاره ایران دو الگوی اصلی وجود دارد: رهن کامل (ودیعه) و ترکیب رهن و اجاره.\n\n## قاعده تبدیل\nقاعده رایج: به ازای هر ۱ میلیون تومان کاهش ودیعه، حدود ۳۰ هزار تومان اجاره ماهانه اضافه می‌شود. این نسبت را با نرخ سود بانکی مقایسه کنید تا ضرر نکنید.\n\n## چه زمانی رهن کامل؟\nاگر نقدینگی کافی دارید و اقامت‌تان بلندمدت است، رهن کامل معمولاً اقتصادی‌تر است.\n\n## چه زمانی رهن و اجاره؟\nاگر جابه‌جایی شغلی دارید یا ترجیح می‌دهید بخشی از سرمایه‌تان آزاد بماند، ترکیب رهن و اجاره انتخاب بهتری است.",
        coverUrl: IMG("int1"), categoryId: catRent.id, authorId: admin2.id, tags: "رهن,اجاره,راهنما", viewCount: 518, isPublished: true, publishedAt: dt(-6),
      },
      {
        title: "تفاوت سند تک‌برگ، شش‌دانگ و واثقی در یک نگاه", slug: "document-types",
        excerpt: "انواع سند در معاملات املاک تفریحی و ریسک‌های هر کدام.",
        content: "نوع سند مهم‌ترین عامل امنیت معامله است.\n\n## تک‌برگ\nمدرن‌ترین و امن‌ترین سند؛ اطلاعات ملک در سامانه ثبت شده و انتقال سریع انجام می‌شود.\n\n## شش‌دانگ منگوله‌دار\nسند قدیمی کاغذی؛ معتبر است اما استعلام ثبتی دقیق‌تر لازم دارد.\n\n## واثقی\nسندی مبتنی بر اعتراض؛ خرید را تنها با مشاوره حقوقی انجام دهید.\n\nدر آگهی‌های ویلاسنتو نوع سند هر ملک به‌صورت شفاف درج می‌شود.",
        coverUrl: IMG("villa5"), categoryId: catLaw.id, authorId: admin2.id, tags: "سند,قوانین", viewCount: 271, isPublished: true, publishedAt: dt(-3),
      },
    ],
  });

  // ── Banners ──
  await db.banner.createMany({
    data: [
      { title: "بنر معرفی خدمات ویلاسنتو", imageUrl: IMG("villa1"), link: "#/search", position: "HOME_TOP", sort: 1 },
      { title: "پیشنهاد ویژه باغ‌ویلاهای شمال", imageUrl: IMG("pool1"), link: "#/search?types=GARDEN_VILLA", position: "HOME_MID", sort: 1 },
      { title: "راهنمای امن معامله", imageUrl: IMG("int1"), link: "#/article/document-types", position: "HOME_BOTTOM", sort: 1 },
    ],
  });

  // ── FAQs ──
  await db.faq.createMany({
    data: [
      { question: "چطور در ویلاسنتو آگهی ثبت کنم؟", answer: "پس از ورود به حساب کاربری، از دکمه «ثبت آگهی» فرم شش‌مرحله‌ای را تکمیل کنید. آگهی پس از بررسی کارشناسان منتشر می‌شود.", sort: 1 },
      { question: "ثبت آگهی هزینه دارد؟", answer: "ثبت آگهی پایه رایگان است. نمایش در بخش «آگهی‌های ویژه» و ارتقا جایگاه طبق تعرفه اعلامی انجام می‌شود.", sort: 2 },
      { question: "چطور مطمئن شوم ملک سند معتبر دارد؟", answer: "نوع سند هر آگهی در صفحه جزئیات درج می‌شود. پیش از معامله حتماً استعلام ثبتی بگیرید؛ مشاوران ویلاسنتو این کار را برای شما انجام می‌دهند.", sort: 3 },
      { question: "درخواست بازدید چگونه کار می‌کند؟", answer: "در صفحه هر ملک روی «درخواست بازدید» بزنید، زمان پیشنهادی را انتخاب کنید؛ درخواست برای مالک یا مشاور ارسال و وضعیت آن در پنل کاربری قابل پیگیری است.", sort: 4 },
      { question: "اگر آگهی نامعتبر دیدم چه کنم؟", answer: "در صفحه آگهی گزینه «گزارش آگهی نامعتبر» را بزنید؛ تیم محتوا حداکثر ظرف ۲۴ ساعت بررسی می‌کند.", sort: 5 },
    ],
  });

  // ── Settings (VillaSento) ──
  await db.systemSetting.createMany({
    data: [
      { key: "site.name", value: "ویلاسنتو" },
      { key: "site.nameEn", value: "VillaSento" },
      { key: "site.tagline", value: "مرجع خرید، فروش، رهن و اجاره باغ، ویلا و باغ‌ویلا" },
      { key: "site.supportPhone", value: "۰۲۱-۹۱۰۰۰۰۰۰" },
      { key: "site.email", value: "info@villasento.example" },
      { key: "site.address", value: "تهران، خیابان ولی‌عصر، برج نگین، طبقه ۹" },
      { key: "site.workingHours", value: "شنبه تا پنجشنبه ۹ تا ۱۸" },
      { key: "site.social", value: JSON.stringify([
        { label: "اینستاگرام", url: "https://instagram.com/villasento" },
        { label: "تلگرام", url: "https://t.me/villasento" },
        { label: "لینکدین", url: "https://linkedin.com/company/villasento" },
      ]) },
      { key: "site.menus", value: JSON.stringify({
        main: [
          { label: "صفحه اصلی", to: "/" },
          { label: "جستجوی املاک", to: "/search" },
          { label: "باغ و ویلا برای فروش", to: "/search?tt=SALE" },
          { label: "رهن و اجاره", to: "/search?tt=RAHN_RENT" },
          { label: "مقالات", to: "/articles" },
          { label: "درباره ما", to: "/page/about" },
        ],
      }) },
      { key: "seo.defaultTitle", value: "ویلاسنتو | خرید، فروش، رهن و اجاره باغ و ویلا" },
      { key: "seo.defaultDescription", value: "ویلاسنتو مرجع خرید و فروش، رهن و اجاره باغ، ویلا، باغ‌ویلا و املاک تفریحی و مسکونی با آگهی‌های تأییدشده و مشاوران معتمد." },
      { key: "site.stats", value: JSON.stringify({ listings: propIds.filter((_, i) => [0,1,2,3,4,5,6,7,11,13].includes(i)).length + 1240, agents: 3 + 48, cities: 16, deals: 820 }) },
      { key: "listing.validityDays", value: "60" },
      { key: "listing.maxImages", value: "12" },
      { key: "upload.maxSizeMB", value: "5" },
      { key: "map.centerLat", value: "36.2" },
      { key: "map.centerLng", value: "52.3" },
      { key: "map.zoom", value: "8" },
      { key: "sms.demoMode", value: "true" },
      { key: "sms.provider", value: "" },
      { key: "sms.apiKey", value: "" },
      { key: "email.smtpConfigured", value: "false" },
    ],
  });

  // ── CMS pages ──
  await db.cmsPage.createMany({
    data: [
      {
        slug: "about", title: "درباره ویلاسنتو", category: "GENERAL", sort: 1,
        content: "ویلاسنتو مرجع تخصصی خرید و فروش، رهن و اجاره باغ، ویلا، باغ‌ویلا و املاک تفریحی و مسکونی است.\n\nما با تأیید دستی آگهی‌ها، احراز مشاوران معتمد و شفافیت کامل در مشخصات ملک (سند، متراژ، سال ساخت و قیمت)، تجربه‌ای امن برای معامله‌گران و خانواده‌ها ساخته‌ایم.\n\nمأموریت ویلاسنتو حذف اطلاعات پراکنده و غیرقابل‌اعتماد از بازار املاک تفریحی ایران است.",
      },
      {
        slug: "contact", title: "تماس با ما", category: "GENERAL", sort: 2,
        content: "کارشناسان ویلاسنتو پاسخگوی شما هستند.\n\nتلفن: ۰۲۱-۹۱۰۰۰۰۰۰\nایمیل: info@villasento.example\nنشانی: تهران، خیابان ولی‌عصر، برج نگین، طبقه ۹\nساعات کاری: شنبه تا پنجشنبه ۹ تا ۱۸\n\nبرای گزارش آگهی نامعتبر، از دکمه «گزارش آگهی» در صفحه همان ملک استفاده کنید.",
      },
      {
        slug: "terms", title: "قوانین و مقررات", category: "LEGAL", sort: 3,
        content: "با ثبت‌نام و استفاده از سامانه ویلاسنتو، بندهای زیر را می‌پذیرید:\n\n۱) مسئولیت صحت اطلاعات آگهی با ثبت‌کننده است و ویلاسنتو آگهی‌ها را پیش از انتشار بررسی می‌کند.\n۲) آگهی‌های تکراری، گمراه‌کننده یا فاقد تصاویر واقعی حذف می‌شوند.\n۳) هر آگهی پس از انتشار مدت ۶۰ روز اعتبار دارد و قابل تمدید است.\n۴) درخواست بازدید و پیام‌ها از طریق سامانه ارسال می‌شود؛ تبادل شماره تماس عمومی در نظرات ممنوع است.\n۵) مشاوران موظف به رعایت قوانین معاملات املاک و اخلاق حرفه‌ای هستند.\n۶) ویلاسنتو فقط بستر آگهی و ارتباط است و طرف قرارداد معامله نیست.",
      },
    ],
  });

  // ── Audit trail ──
  await db.auditLog.createMany({
    data: [
      { actorId: superAdmin.id, actorPhone: superAdmin.phone, action: "SEED_RUN", entity: "System", meta: JSON.stringify({ note: "initial VillaSento seed" }) },
      { actorId: superAdmin.id, actorPhone: superAdmin.phone, action: "PROPERTY_PUBLISH", entity: "Property", entityId: propIds[0] },
      { actorId: admin2.id, actorPhone: admin2.phone, action: "ARTICLE_CREATE", entity: "Article", meta: JSON.stringify({ count: 3 }) },
    ],
  });

  console.log("✅ VillaSento seed complete:");
  console.log(`   Users: 10 (1 super_admin, 1 admin, 3 agents, 2 owners, 3 customers) — password: ${DEMO_PASSWORD}`);
  console.log(`   Provinces: ${provincesData.length} | Properties: ${propIds.length} (incl. PENDING×2, DRAFT, EXPIRED, REJECTED)`);
  console.log(`   Views: ~30 days × properties | Visits: 5 | Messages: 3`);
  console.log(`   Articles: 3 | Banners: 3 | FAQs: 5 | CMS: 3`);
  console.log(`   Logins → admin 09120000001 | agent 09120000002 | owner 09120000005 | customer 09123456789 (pass 123456 + OTP demo)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
