/**
 * Region coordinate research — queries OpenStreetMap Nominatim for the real
 * coordinates of the Villasento target regions (جاده سنتو corridor, NW of Mashhad).
 * Output: JSON report used by the region seed. NO fabricated coordinates:
 * only OSM-reported results are kept; unmatched names go to "needs review".
 */
const queries: { key: string; fa: string; variants: string[] }[] = [
  { key: "chaharfasl", fa: "چهارفصل", variants: ["چهار فصل", "روستای چهار فصل", "چهارفصل مشهد"] },
  { key: "ruhabad", fa: "روح‌آباد", variants: ["روح آباد", "روح‌آباد مشهد", "روح اباد مشهد"] },
  { key: "eshghabad", fa: "عشق‌آباد", variants: ["عشق آباد مشهد", "عشق‌آباد مشهد"] },
  { key: "asgarieh", fa: "عسگریه", variants: ["عسگریه مشهد", "عسکریه مشهد"] },
  { key: "bazmargan", fa: "بازمرگان", variants: ["بازمرگان مشهد"] },
  { key: "rabatoo", fa: "رباطو", variants: ["رباطو مشهد", "رباط او مشهد", "رباط مشهد"] },
  { key: "ahmadabadmoghbel", fa: "احمدآباد مقبل", variants: ["احمدآباد مقبل مشهد", "احمد آباد مقبل"] },
  { key: "ghaderabad", fa: "قادرآباد", variants: ["قادرآباد مشهد"] },
  { key: "farahabad", fa: "فرح‌آباد", variants: ["فرح آباد مشهد", "فرح‌آباد مشهد"] },
  { key: "kharabehamin", fa: "خرابه امین", variants: ["خرابه‌امین", "خرابه امین مشهد", "امین مشهد روستا"] },
  { key: "khansaadat", fa: "خان سعادت", variants: ["خان سعادت مشهد", "سعادت مشهد روستا"] },
  { key: "kalatehesmail", fa: "کلاته اسماعیل", variants: ["کلاته اسماعیل مشهد", "کلاته اسماعیل"] },
  { key: "sangsiah", fa: "سنگ سیاه", variants: ["سنگ سیاه مشهد"] },
  { key: "shahinghaleh", fa: "شاهین‌قلعه", variants: ["شاهین قلعه مشهد", "شاهین‌قلعه مشهد"] },
  { key: "hassanabadborji", fa: "حسن‌آباد برجی", variants: ["حسن آباد برجی", "حسن‌آباد برجی مشهد"] },
  { key: "reyhan", fa: "ریحان", variants: ["ریحان مشهد روستا", "ریحان مشهد"] },
  { key: "feilian", fa: "فیلیان", variants: ["فیلیان مشهد"] },
  { key: "chehcheh", fa: "چهچه", variants: ["چهچه مشهد"] },
  { key: "chenarsokhteh", fa: "چنارسوخته", variants: ["چنار سوخته مشهد", "چنارسوخته مشهد"] },
  { key: "dovin", fa: "دوین", variants: ["دوین مشهد"] },
  { key: "chahmal", fa: "چاه‌مال", variants: ["چاه مال مشهد", "چاهمال مشهد"] },
  { key: "shirhesar", fa: "شیرحصار", variants: ["شیرحصار مشهد", "شیرحصار"] },
  { key: "mashhad", fa: "مشهد", variants: ["مشهد"] },
  { key: "dehnovmianvelayat", fa: "دهنو میان ولایت", variants: ["دهنو میان ولایت مشهد"] },
];

// viewbox around Mashhad + قوچان corridor (left,top,right,bottom = lngMin,latMax,lngMax,latMin)
const VIEWBOX = "58.8,36.85,60.2,36.15";
const UA = "villasento-region-research/1.0 (one-time research; contact dev@villasento.local)";

async function nominatim(q: string): Promise<any[]> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&countrycodes=ir&viewbox=${VIEWBOX}&bounded=1&limit=6&accept-language=fa`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function main() {
  const report: Record<string, unknown> = {};
  for (const item of queries) {
    const found: unknown[] = [];
    for (const v of [item.fa, ...item.variants]) {
      try {
        const results = await nominatim(v);
        for (const r of results) {
          found.push({
            query: v,
            name: r.name,
            display: r.display_name,
            lat: parseFloat(r.lat),
            lon: parseFloat(r.lon),
            type: r.type,
            class: r.class,
            addresstype: r.addresstype,
          });
        }
      } catch (e) {
        found.push({ query: v, error: String(e) });
      }
      await new Promise((r) => setTimeout(r, 1200)); // Nominatim rate limit
    }
    report[item.key] = { fa: item.fa, results: found };
    console.error(`researched: ${item.fa} → ${found.length} hits`);
  }
  console.log(JSON.stringify(report, null, 2));
}

main();
