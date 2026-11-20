/**
 * Persian→Latin place slugs (pure module: safe for client + server).
 * Used by listing slugs, /city/{slug} pages and the sitemap.
 */

const PROPERTY_TYPE_EN: Record<string, string> = {
  GARDEN: "garden",
  VILLA: "villa",
  GARDEN_VILLA: "garden-villa",
  HOUSE: "house",
  APARTMENT: "apartment",
  LAND: "land",
};

/** Small Persian→Latin transliteration map for Iranian cities/areas (fallback: stripped) */
export const PLACE_EN: Record<string, string> = {
  "تهران": "tehran", "مشهد": "mashhad", "کرج": "karaj", "اصفهان": "isfahan", "شیراز": "shiraz",
  "تبریز": "tabriz", "قم": "qom", "اهواز": "ahvaz", "کرمان": "kerman", "یزد": "yazd",
  "رشت": "rasht", "ساری": "sari", "گرگان": "gorgan", "بابل": "babol", "آمل": "amol",
  "قائم‌شهر": "qaemshahr", "نوشهر": "nowshahr", "چالوس": "chalus", "تنکابن": "tonekabon",
  "رامسر": "ramsar", "انزلی": "anzali", "لنگرود": "langarud", "کردکوی": "kordkuy",
  "لواسان": "lavasan", "شهرک غرب": "shahrak-gharb", "سعادت‌آباد": "saadatabad",
  "نیاوران": "niavaran", "الهیه": "elahiyeh", "زعفرانیه": "zaferanieh", "ولنجک": "velanjak",
  "مهرشهر": "mehrshahr", "فومن": "fuman", "مازندران": "mazandaran", "گیلان": "gilan",
  "آب‌علی": "ab-ali", "شمال": "shomal", "جاده چالوس": "chalus-road",
  // Villasento target corridor (جاده سنتو / میان ولایت) — matches Region.nameEn
  "جاده سنتو": "santoo-road", "رضویه": "razaviyeh", "قلعه سیاه": "razaviyeh",
  "ناظریه": "nazariyeh", "چهارفصل": "chahar-fasl", "چهار فصل": "chahar-fasl",
  "میان ولایت": "mian-velayat", "میان‌ولایت": "mian-velayat",
  "روح‌آباد": "ruh-abad", "عشق‌آباد": "eshgh-abad", "عسگریه": "asgarieh",
  "بازمرگان": "bazmargan", "سنگ سیاه": "sang-siah", "شاهین‌قلعه": "shahin-ghaleh",
  "ریحان": "reyhan", "چهچه": "chehcheh", "چنارسوخته": "chenar-sokhteh",
  "دوین": "dovin", "شیرحصار": "shir-hesar", "امینیه": "aminiyeh",
  "خان سعادت": "khan-saadat", "احمدآباد مقبل": "ahmadabad-moghbel",
  "فیلیان": "feilian", "خرابه امین": "kharabeh-amin", "قادرآباد": "ghader-abad",
  "فرح‌آباد": "farah-abad", "حسن‌آباد برجی": "hassanabad-borji", "رباطو": "rabatoo",
  "چاه‌مال": "chah-mal", "کلاته اسماعیل": "kalateh-esmail",
};

export function placeSlug(name?: string | null): string {
  if (!name) return "";
  const clean = name.trim().replace(/\u200c/g, "-");
  if (PLACE_EN[clean]) return PLACE_EN[clean];
  if (PLACE_EN[clean.replace(/-/g, " ")]) return PLACE_EN[clean.replace(/-/g, " ")];
  return clean.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

export function propertyTypeEn(type: string): string {
  return PROPERTY_TYPE_EN[type] ?? "property";
}

/** Persian city name → Latin URL slug (for /city/... pages and sitemap) */
export function cityNameToSlug(name: string): string {
  const s = placeSlug(name);
  return s || `city-${safeB64(name)}`;
}

const PLACE_FA_BY_EN: Record<string, string> = Object.fromEntries(
  Object.entries(PLACE_EN).map(([fa, en]) => [en, fa])
);

/** /city/{slug} → Persian city name (Latin slug, encoded Persian, or exact name) */
export function citySlugToName(slug: string): string {
  const decoded = (() => { try { return decodeURIComponent(slug); } catch { return slug; } })();
  if (PLACE_FA_BY_EN[decoded]) return PLACE_FA_BY_EN[decoded];
  const byFa = Object.keys(PLACE_EN).find((fa) => placeSlug(fa) === decoded);
  if (byFa) return byFa;
  return decoded;
}

function safeB64(name: string): string {
  try {
    // btoa fails on non-Latin1; encode via encodeURIComponent
    return btoa(unescape(encodeURIComponent(name))).replace(/[^a-zA-Z0-9]/g, "").slice(0, 10).toLowerCase();
  } catch {
    return "x";
  }
}
