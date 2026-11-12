import { db } from "@/lib/db";
import { badRequest, forbidden, notFound } from "../http";
import { audit } from "../audit";
import { isAdmin, type SafeUser } from "./properties";

// ───────────────────────── Articles ─────────────────────────

export async function listArticles(opts: { categoryId?: string; q?: string; page?: number; pageSize?: number }) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(24, Math.max(1, opts.pageSize ?? 9));
  const where: Record<string, unknown> = { isPublished: true };
  if (opts.categoryId) where.categoryId = opts.categoryId;
  if (opts.q) where.OR = [{ title: { contains: opts.q } }, { excerpt: { contains: opts.q } }];
  const [total, items] = await Promise.all([
    db.article.count({ where }),
    db.article.findMany({
      where,
      include: { category: { select: { name: true, slug: true } }, author: { select: { fullName: true } } },
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return {
    items: items.map((a) => ({
      id: a.id, title: a.title, slug: a.slug, excerpt: a.excerpt, coverUrl: a.coverUrl,
      category: a.category, author: a.author?.fullName ?? "تحریریه ویلاسنتو",
      viewCount: a.viewCount, publishedAt: a.publishedAt,
    })),
    total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function articleBySlug(slug: string) {
  const a = await db.article.findUnique({
    where: { slug },
    include: { category: { select: { name: true, slug: true } }, author: { select: { fullName: true } } },
  });
  if (!a || !a.isPublished) throw notFound("مقاله یافت نشد");
  await db.article.update({ where: { id: a.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});
  const related = await db.article.findMany({
    where: { isPublished: true, id: { not: a.id }, ...(a.categoryId ? { categoryId: a.categoryId } : {}) },
    select: { id: true, title: true, slug: true, excerpt: true, coverUrl: true, publishedAt: true },
    orderBy: { publishedAt: "desc" },
    take: 4,
  });
  return { ...a, authorName: a.author?.fullName ?? "تحریریه ویلاسنتو", related };
}

export async function articleCategories() {
  return db.articleCategory.findMany({
    orderBy: { sort: "asc" },
    include: { _count: { select: { articles: { where: { isPublished: true } } } } },
  });
}

// ───────── Admin CRUD ─────────
export async function adminArticles(user: SafeUser) {
  if (!isAdmin(user)) throw forbidden();
  return db.article.findMany({
    include: { category: { select: { name: true } }, author: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function upsertArticle(user: SafeUser, data: {
  id?: string; title: string; slug?: string; excerpt?: string; content: string;
  coverUrl?: string; categoryId?: string; tags?: string; isPublished?: boolean;
}) {
  if (!isAdmin(user)) throw forbidden();
  const slug = data.slug?.trim() || data.title.trim().replace(/\s+/g, "-").slice(0, 60);
  const payload = {
    title: data.title.trim(),
    slug,
    excerpt: data.excerpt?.trim() || data.content.slice(0, 150),
    content: data.content,
    coverUrl: data.coverUrl || null,
    categoryId: data.categoryId || null,
    tags: data.tags ?? "",
    isPublished: data.isPublished ?? true,
  };
  if (data.id) {
    await db.article.update({ where: { id: data.id }, data: payload });
  } else {
    const exists = await db.article.findUnique({ where: { slug } });
    if (exists) throw badRequest("نامک (slug) تکراری است");
    await db.article.create({ data: { ...payload, publishedAt: payload.isPublished ? new Date() : null } });
  }
  await audit({ actorId: user.id, action: data.id ? "ARTICLE_UPDATE" : "ARTICLE_CREATE", entity: "Article", meta: { slug } });
  return { ok: true };
}

export async function deleteArticle(user: SafeUser, id: string) {
  if (!isAdmin(user)) throw forbidden();
  await db.article.delete({ where: { id } });
  await audit({ actorId: user.id, action: "ARTICLE_DELETE", entity: "Article", entityId: id });
  return { ok: true };
}

export async function upsertArticleCategory(user: SafeUser, data: { id?: string; name: string; slug?: string }) {
  if (!isAdmin(user)) throw forbidden();
  const slug = data.slug?.trim() || data.name.trim().replace(/\s+/g, "-");
  if (data.id) {
    await db.articleCategory.update({ where: { id: data.id }, data: { name: data.name, slug } });
  } else {
    const exists = await db.articleCategory.findUnique({ where: { slug } });
    if (exists) throw badRequest("نامک دسته تکراری است");
    await db.articleCategory.create({ data: { name: data.name, slug } });
  }
  return { ok: true };
}

// ───────────────────────── Banners ─────────────────────────

export async function activeBanners(position?: string) {
  return db.banner.findMany({
    where: { isActive: true, ...(position ? { position } : {}) },
    orderBy: { sort: "asc" },
    take: 10,
  });
}

export async function adminBanners(user: SafeUser) {
  if (!isAdmin(user)) throw forbidden();
  return db.banner.findMany({ orderBy: { sort: "asc" } });
}

export async function upsertBanner(user: SafeUser, data: {
  id?: string; title: string; imageUrl: string; link?: string; position?: string; sort?: number; isActive?: boolean;
}) {
  if (!isAdmin(user)) throw forbidden();
  const payload = {
    title: data.title, imageUrl: data.imageUrl, link: data.link || null,
    position: data.position && ["HOME_TOP", "HOME_MID", "HOME_BOTTOM", "SIDEBAR"].includes(data.position) ? data.position : "HOME_MID",
    sort: data.sort ?? 0, isActive: data.isActive ?? true,
  };
  if (data.id) await db.banner.update({ where: { id: data.id }, data: payload });
  else await db.banner.create({ data: payload });
  await audit({ actorId: user.id, action: data.id ? "BANNER_UPDATE" : "BANNER_CREATE", entity: "Banner", meta: { title: data.title } });
  return { ok: true };
}

export async function deleteBanner(user: SafeUser, id: string) {
  if (!isAdmin(user)) throw forbidden();
  await db.banner.delete({ where: { id } });
  return { ok: true };
}

// ───────────────────────── FAQs ─────────────────────────

export async function activeFaqs() {
  return db.faq.findMany({ where: { isActive: true }, orderBy: { sort: "asc" } });
}

export async function adminFaqs(user: SafeUser) {
  if (!isAdmin(user)) throw forbidden();
  return db.faq.findMany({ orderBy: { sort: "asc" } });
}

export async function upsertFaq(user: SafeUser, data: { id?: string; question: string; answer: string; sort?: number; isActive?: boolean }) {
  if (!isAdmin(user)) throw forbidden();
  const payload = { question: data.question, answer: data.answer, sort: data.sort ?? 0, isActive: data.isActive ?? true };
  if (data.id) await db.faq.update({ where: { id: data.id }, data: payload });
  else await db.faq.create({ data: payload });
  return { ok: true };
}

export async function deleteFaq(user: SafeUser, id: string) {
  if (!isAdmin(user)) throw forbidden();
  await db.faq.delete({ where: { id } });
  return { ok: true };
}

// ───────────────────────── CMS pages (admin) ─────────────────────────

export async function adminCmsPages(user: SafeUser) {
  if (!isAdmin(user)) throw forbidden();
  return db.cmsPage.findMany({ orderBy: { sort: "asc" } });
}

export async function upsertCmsPage(user: SafeUser, data: { id?: string; slug: string; title: string; content: string; category?: string; isPublished?: boolean }) {
  if (!isAdmin(user)) throw forbidden();
  const payload = {
    slug: data.slug.trim(), title: data.title, content: data.content,
    category: data.category && ["GENERAL", "LEGAL", "HELP"].includes(data.category) ? data.category : "GENERAL",
    isPublished: data.isPublished ?? true,
  };
  if (data.id) await db.cmsPage.update({ where: { id: data.id }, data: payload });
  else {
    const exists = await db.cmsPage.findUnique({ where: { slug: payload.slug } });
    if (exists) throw badRequest("نامک صفحه تکراری است");
    await db.cmsPage.create({ data: payload });
  }
  await audit({ actorId: user.id, action: data.id ? "CMS_UPDATE" : "CMS_CREATE", entity: "CmsPage", meta: { slug: payload.slug } });
  return { ok: true };
}

export async function deleteCmsPage(user: SafeUser, id: string) {
  if (!isAdmin(user)) throw forbidden();
  await db.cmsPage.delete({ where: { id } });
  return { ok: true };
}
