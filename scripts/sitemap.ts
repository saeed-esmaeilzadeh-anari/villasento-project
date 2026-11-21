/**
 * Validate the same database-backed sitemap used by Next.js.
 * Run: bun run sitemap
 * This script deliberately does not write public/sitemap.xml.
 */
import generateSitemap from "../src/app/sitemap";

const configuredOrigin =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://www.vilasento.ir"
    : "http://localhost:3000");
const expectedOrigin = new URL(configuredOrigin).origin;

async function main() {
  const entries = await generateSitemap();
  const urls = entries.map((entry) => entry.url);
  const duplicates = urls.filter((url, index) => urls.indexOf(url) !== index);
  const invalid = urls.filter((rawUrl) => {
    try {
      const url = new URL(rawUrl);
      const segments = url.pathname.split("/").map((segment) => decodeURIComponent(segment).toLowerCase());
      return (
        url.origin !== expectedOrigin ||
        url.hash !== "" ||
        url.search !== "" ||
        segments.some((segment) => segment === "undefined" || segment === "null") ||
        !["http:", "https:"].includes(url.protocol)
      );
    } catch {
      return true;
    }
  });

  console.log("Expected origin: " + expectedOrigin);
  console.log("Sitemap entries: " + urls.length);
  console.log("Duplicate URLs: " + duplicates.length);
  console.log("Invalid URLs: " + invalid.length);
  if (duplicates.length) console.error("Duplicates:", duplicates);
  if (invalid.length) console.error("Invalid:", invalid);
  if (duplicates.length || invalid.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Sitemap validation failed:", error);
  process.exitCode = 1;
});
