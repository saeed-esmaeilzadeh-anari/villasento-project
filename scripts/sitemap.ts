/**
 * Validate the same database-backed sitemap used by Next.js.
 * Run: bun run sitemap
 * This script deliberately does not write public/sitemap.xml.
 */
import generateSitemap from "../src/app/sitemap";

async function main() {
  const entries = await generateSitemap();
  const urls = entries.map((entry) => entry.url);
  const duplicates = urls.filter((url, index) => urls.indexOf(url) !== index);
  const invalid = urls.filter((url) =>
    !url.startsWith("https://www.vilasento.ir/") ||
    url.includes("localhost") ||
    url.includes("#") ||
    url.endsWith("/undefined") || url.includes("/undefined/") ||
    url.endsWith("/null") || url.includes("/null/")
  );

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
