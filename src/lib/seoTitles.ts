import { faNum, priceLine } from "./fa";

/**
 * Shared (server + client) dynamic SEO copy builders for listings.
 * Title format: «خرید ویلای ۳۰۰ متری در لواسان | ویلاسنتو»
 * Description: real listing data only — no keyword stuffing.
 */

export const TRANSACTION_SEO_VERB: Record<string, string> = {
  SALE: "خرید",
  RAHN: "رهن",
  RAHN_RENT: "رهن و اجاره",
  RENT: "اجاره",
};

/** Ezafe-aware Persian compound: «ویلا» → «ویلای»، «خانه ویلایی» → unchanged */
function withEzafe(label: string): string {
  if (!label) return "";
  if (label.endsWith("ی") || label.endsWith("ه")) return label;
  return label + "ی";
}

export function listingSeoTitle(p: {
  typeLabel: string;
  transactionType: string;
  landArea?: number | null;
  buildArea?: number | null;
  area?: string | null;
  city?: string | null;
}): string {
  const verb = TRANSACTION_SEO_VERB[p.transactionType] ?? "خرید";
  const size = p.landArea ?? p.buildArea;
  const where = [p.area, p.city].filter(Boolean).join(" ");
  const core = `${verb} ${withEzafe(p.typeLabel)}${size ? ` ${faNum(size)} متری` : ""}${where ? ` در ${where}` : ""}`;
  return core;
}

export function listingSeoDescription(p: {
  transactionType: string;
  salePrice?: number | null;
  rahnAmount?: number | null;
  rentAmount?: number | null;
  province?: string | null;
  city?: string | null;
  area?: string | null;
  landArea?: number | null;
  buildArea?: number | null;
  bedrooms?: number | null;
  docLabel?: string | null;
  description?: string | null;
}): string {
  const parts: string[] = [];
  const price = priceLine(p.transactionType, p.salePrice, p.rahnAmount, p.rentAmount);
  if (price && price !== "توافقی") parts.push(price);
  const where = [p.province, p.city, p.area].filter(Boolean).join("، ");
  if (where) parts.push(where);
  const specs: string[] = [];
  if (p.buildArea) specs.push(`${faNum(p.buildArea)} متر بنا`);
  if (p.landArea) specs.push(`${faNum(p.landArea)} متر زمین`);
  if (p.bedrooms) specs.push(`${faNum(p.bedrooms)} خواب`);
  if (specs.length) parts.push(specs.join("، "));
  if (p.docLabel) parts.push(`سند ${p.docLabel}`);
  const text = parts.join(" — ");
  const desc = (p.description ?? "").trim().replace(/\s+/g, " ").slice(0, 110);
  return desc ? `${text} — ${desc}` : text;
}
