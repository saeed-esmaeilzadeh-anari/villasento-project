export const MIN_ARTICLE_TEXT_LENGTH = 300;
export const MIN_CMS_TEXT_LENGTH = 120;
export const MIN_REGION_DESCRIPTION_LENGTH = 80;

/** Strip markup and common Markdown syntax before applying content-quality gates. */
export function plainTextLength(value: string | null | undefined): number {
  if (!value) return 0;
  return value
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[\x60*_>#~|]/g, " ")
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/gi, " ")
    .replace(/\s+/g, " ")
    .trim().length;
}

export function isIndexableArticle(content: string | null | undefined) {
  return plainTextLength(content) >= MIN_ARTICLE_TEXT_LENGTH;
}

export function isIndexableCmsPage(content: string | null | undefined) {
  return plainTextLength(content) >= MIN_CMS_TEXT_LENGTH;
}
