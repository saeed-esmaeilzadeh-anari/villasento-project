/**
 * Generate public/og-cover.png (1200x630) — Open Graph / Twitter card image.
 * Uses the project's Vazirmatn font for Persian text. Run: bun scripts/gen-og.ts
 */
import sharp from "sharp";
import { join } from "path";
import fs from "fs";

const W = 1200, H = 630;
const fontPath = "public/fonts/Vazirmatn-Bold.woff2";

async function main() {
  const font = fs.existsSync(fontPath) ? fontPath : "public/fonts/Vazirmatn-Regular.woff2";

  // WOFF2 is not supported by librsvg — convert via fontkit is heavy; instead
  // try TTF/OTF presence, else render without text glyph shaping (fallback logo-only)
  const ttf = ["public/fonts/Vazirmatn-Bold.ttf", "public/fonts/Vazirmatn-Regular.ttf"]
    .find((f) => fs.existsSync(f)) ?? null;

  const svg = ttf
    ? `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0d5c46"/>
      <stop offset="100%" stop-color="#0a3d2f"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <circle cx="1060" cy="120" r="220" fill="#ffffff" opacity="0.06"/>
  <circle cx="140" cy="540" r="260" fill="#ffffff" opacity="0.05"/>
  <text x="${W / 2}" y="270" font-family="Vazirmatn" font-weight="700" font-size="88" fill="#ffffff" text-anchor="middle">ویلاسنتو</text>
  <text x="${W / 2}" y="360" font-family="Vazirmatn" font-weight="500" font-size="44" fill="#a7d7c5" text-anchor="middle">مرجع خرید، فروش، رهن و اجاره ویلا و باغ</text>
  <text x="${W / 2}" y="440" font-family="Vazirmatn" font-weight="400" font-size="30" fill="#e8f5f0" text-anchor="middle">آگهی‌های تأییدشده با مشخصات کامل سند — VillaSento</text>
  <text x="${W / 2}" y="540" font-family="Vazirmatn" font-weight="500" font-size="34" fill="#ffffff" text-anchor="middle" direction="ltr">09356966365</text>
</svg>`
    : `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0d5c46"/>
      <stop offset="100%" stop-color="#0a3d2f"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <circle cx="1060" cy="120" r="220" fill="#ffffff" opacity="0.06"/>
  <circle cx="140" cy="540" r="260" fill="#ffffff" opacity="0.05"/>
  <text x="600" y="320" font-size="140" font-weight="700" fill="#ffffff" text-anchor="middle" font-family="sans-serif">VS</text>
</svg>`;

  await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9 })
    .toFile(join(process.cwd(), "public", "og-cover.png"));
  console.log("og-cover.png generated (font:", ttf ?? "fallback-logo", ")");
}

main().catch((e) => { console.error(e); process.exit(1); });
