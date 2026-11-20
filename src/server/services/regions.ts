/**
 * Region service — hierarchical geographic scopes for Villasento
 * (جاده سنتو / رضویه / ناظریه / چهارفصل corridor and its villages).
 *
 * Public: active region tree with REAL published-listing counts, search by
 * Persian/English/alternative names, descendant resolution for filters.
 * Admin: CRUD with duplicate prevention + audit logging (server-side authz).
 */
import { db } from "@/lib/db";
import { audit } from "../audit";
import { badRequest, forbidden, notFound } from "../http";
import type { SafeUser } from "../session";
import { isAdmin } from "./properties";

export const REGION_TYPES: Record<string, string> = {
  PROVINCE: "استان",
  COUNTY: "شهرستان",
  DEHESTAN: "دهستان",
  CITY: "شهر",
  ROAD: "محور / جاده",
  VILLAGE: "روستا",
  AREA: "محدوده / محله",
};

export const REGION_GEO_STATUS: Record<string, string> = {
  VERIFIED: "تأییدشده",
  UNVERIFIED: "نیازمند بررسی",
};

type RegionRow = {
  id: string; name: string; nameEn: string; altNames: string; type: string;
  parentId: string | null; provinceId: string | null;
  lat: number | null; lng: number | null; geoStatus: string;
  isActive: boolean; isFeatured: boolean; sort: number; description: string;
  legacyCityId: string | null; legacyAreaId: string | null;
  _count?: { properties: number };
};

export type RegionNode = Omit<RegionRow, "_count"> & {
  typeLabel: string;
  count: number; // REAL count of published listings directly attached
  totalCount: number; // direct + descendants
  children: RegionNode[];
  path: string; // "شهرستان مشهد › دهستان میان ولایت › رضویه"
};

/** All regions (optionally incl. inactive for admin) */
async function fetchRegions(opts?: { includeInactive?: boolean }): Promise<RegionRow[]> {
  return db.region.findMany({
    where: opts?.includeInactive ? {} : { isActive: true },
    orderBy: [{ sort: "asc" }, { name: "asc" }],
    include: { _count: { select: { properties: { where: { status: "PUBLISHED" } } } } },
  }) as unknown as Promise<RegionRow[]>;
}

function buildPath(rows: RegionRow[], node: RegionRow): string {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const parts: string[] = [node.name];
  let cur = node.parentId;
  while (cur) {
    const parent = byId.get(cur);
    if (!parent) break;
    parts.unshift(parent.name);
    cur = parent.parentId;
  }
  return parts.join(" › ");
}

function buildTree(rows: RegionRow[]): RegionNode[] {
  const countByDirect = new Map<string, number>();
  for (const r of rows) countByDirect.set(r.id, r._count?.properties ?? 0);

  const nodes = new Map<string, RegionNode>();
  for (const r of rows) {
    nodes.set(r.id, {
      ...r,
      _count: undefined,
      typeLabel: REGION_TYPES[r.type] ?? r.type,
      count: countByDirect.get(r.id) ?? 0,
      totalCount: 0,
      children: [],
      path: buildPath(rows, r),
    } as RegionNode);
  }
  const roots: RegionNode[] = [];
  for (const node of nodes.values()) {
    if (node.parentId && nodes.has(node.parentId)) nodes.get(node.parentId)!.children.push(node);
    else roots.push(node);
  }
  // aggregate real counts up the tree
  const aggregate = (node: RegionNode): number => {
    node.totalCount = node.count + node.children.reduce((sum, c) => sum + aggregate(c), 0);
    return node.totalCount;
  };
  roots.forEach(aggregate);
  return roots;
}

/** Public: full active tree + real counts + verified bbox of the target corridor */
export async function regionTreePublic() {
  const rows = await fetchRegions();
  const tree = buildTree(rows);
  // map focus = the FEATURED (main) verified regions first — the جاده سنتو
  // corridor itself — falling back to every verified region with coordinates.
  const featured = rows.filter((r) => r.isFeatured && r.geoStatus === "VERIFIED" && r.lat != null && r.lng != null);
  const verified = rows.filter((r) => r.geoStatus === "VERIFIED" && r.lat != null && r.lng != null);
  const scope = featured.length ? featured : verified;
  const bbox = scope.length
    ? {
        minLat: Math.min(...scope.map((r) => r.lat!)),
        maxLat: Math.max(...scope.map((r) => r.lat!)),
        minLng: Math.min(...scope.map((r) => r.lng!)),
        maxLng: Math.max(...scope.map((r) => r.lng!)),
      }
    : null;
  return { tree, bbox, total: rows.length };
}

/** Public: featured (main) regions for the home page — real counts only */
export async function featuredRegions(limit = 12) {
  const rows = await fetchRegions();
  const tree = buildTree(rows);
  const flat: RegionNode[] = [];
  const walk = (nodes: RegionNode[]) => nodes.forEach((n) => { flat.push(n); walk(n.children); });
  walk(tree);
  return flat
    .filter((r) => r.isFeatured)
    .sort((a, b) => b.totalCount - a.totalCount || a.sort - b.sort)
    .slice(0, limit);
}

/** Public: search by Persian name, Latin slug or alternative names */
export async function searchRegions(q: string, limit = 15) {
  const term = q.trim();
  if (!term) return [];
  const rows = await fetchRegions();
  const tree = buildTree(rows);
  const flat: RegionNode[] = [];
  const walk = (nodes: RegionNode[]) => nodes.forEach((n) => { flat.push(n); walk(n.children); });
  walk(tree);
  const norm = (s: string) => s.replace(/\u200c/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  const needle = norm(term);
  return flat
    .filter((r) => {
      if (norm(r.name).includes(needle)) return true;
      if (r.nameEn.toLowerCase().includes(needle)) return true;
      const alts = r.altNames.split("|").map((a) => norm(a)).filter(Boolean);
      return alts.some((a) => a.includes(needle) || needle.includes(a));
    })
    .slice(0, limit);
}

/** Region by Latin slug (active) with parent chain + real counts */
export async function regionBySlug(slug: string) {
  const row = await db.region.findUnique({ where: { nameEn: slug }, include: { _count: { select: { properties: { where: { status: "PUBLISHED" } } } } } });
  if (!row || !row.isActive) return null;
  const chain: { name: string; nameEn: string }[] = [];
  let cur = row.parentId;
  for (let i = 0; cur && i < 10; i++) {
    const parent = await db.region.findUnique({ where: { id: cur }, select: { name: true, nameEn: true, parentId: true, isActive: true } });
    if (!parent) break;
    chain.unshift({ name: parent.name, nameEn: parent.nameEn });
    cur = parent.parentId;
  }
  const children = await db.region.findMany({
    where: { parentId: row.id, isActive: true },
    orderBy: [{ sort: "asc" }, { name: "asc" }],
    select: { id: true, name: true, nameEn: true, type: true, lat: true, lng: true, geoStatus: true, _count: { select: { properties: { where: { status: "PUBLISHED" } } } } },
  });
  // nearby verified regions = siblings (+parent road/dehestan) with real coordinates
  const siblingIds = (await db.region.findMany({ where: { parentId: row.parentId ?? undefined, isActive: true }, select: { id: true } })).map((s) => s.id);
  const nearby = await db.region.findMany({
    where: { id: { in: siblingIds, not: row.id }, isActive: true, geoStatus: "VERIFIED", lat: { not: null } },
    orderBy: { sort: "asc" },
    take: 8,
    select: { id: true, name: true, nameEn: true, type: true, lat: true, lng: true },
  });
  return {
    ...row,
    typeLabel: REGION_TYPES[row.type] ?? row.type,
    count: row._count.properties,
    ancestors: chain,
    children,
    nearby,
  };
}

/** Resolve a region + all its descendants (self included) — used by search filters */
export async function regionWithDescendantsIds(idOrSlug: string): Promise<string[]> {
  const region = await db.region.findFirst({
    where: { OR: [{ id: idOrSlug }, { nameEn: idOrSlug }] },
    select: { id: true, isActive: true },
  });
  if (!region || !region.isActive) return [];
  const ids: string[] = [region.id];
  let frontier = [region.id];
  for (let depth = 0; depth < 8 && frontier.length; depth++) {
    const kids = await db.region.findMany({ where: { parentId: { in: frontier }, isActive: true }, select: { id: true } });
    frontier = kids.map((k) => k.id);
    ids.push(...frontier);
  }
  return ids;
}

// ───────────────────────── Admin CRUD ─────────────────────────

function assertAdmin(user: SafeUser) {
  if (!isAdmin(user)) throw forbidden("این بخش فقط برای مدیران سامانه است");
}

export async function adminListRegions(user: SafeUser, q?: string) {
  assertAdmin(user);
  const rows = await fetchRegions({ includeInactive: true });
  const tree = buildTree(rows);
  if (!q?.trim()) return { tree, types: REGION_TYPES };
  const needle = q.trim().toLowerCase();
  const flat: RegionNode[] = [];
  const walk = (nodes: RegionNode[]) => nodes.forEach((n) => { flat.push(n); walk(n.children); });
  walk(tree);
  return {
    tree: flat.filter((r) =>
      r.name.toLowerCase().includes(needle) ||
      r.nameEn.toLowerCase().includes(needle) ||
      r.altNames.toLowerCase().includes(needle)
    ),
    types: REGION_TYPES,
  };
}

export type RegionUpsertInput = {
  id?: string;
  name?: string;
  nameEn?: string;
  altNames?: string;
  type?: string;
  parentId?: string | null;
  /** numbers or numeric strings (the admin form sends strings) */
  lat?: number | string | null;
  lng?: number | string | null;
  geoStatus?: string;
  isActive?: boolean;
  isFeatured?: boolean;
  sort?: number | string;
  description?: string;
};

export async function upsertRegion(user: SafeUser, input: RegionUpsertInput) {
  assertAdmin(user);
  const name = input.name?.trim();
  if (!name) throw badRequest("نام منطقه الزامی است");
  if (name.length > 80) throw badRequest("نام منطقه طولانی است");

  // coerce numeric-ish inputs (admin form sends strings) — server-side validation
  const toNum = (v: unknown): number | null => {
    if (v == null || v === "") return null;
    const n = typeof v === "number" ? v : Number(String(v).trim());
    if (!Number.isFinite(n)) throw badRequest("مختصات جغرافیایی باید عدد معتبر باشد");
    return n;
  };
  const lat = toNum(input.lat);
  const lng = toNum(input.lng);
  const sort = Math.max(0, Math.trunc(toNum(input.sort) ?? 0));

  if (!input.id) {
    if (!input.nameEn?.trim()) throw badRequest("شناسه لاتین (nameEn) الزامی است");
    if (!/^[a-z0-9-]{2,80}$/.test(input.nameEn.trim())) throw badRequest("شناسه لاتین باید فقط شامل حروف انگلیسی کوچک، رقم و خط تیره باشد");
  }
  if (input.type && !(input.type in REGION_TYPES)) throw badRequest("نوع منطقه نامعتبر است");
  if (input.geoStatus && !(input.geoStatus in REGION_GEO_STATUS)) throw badRequest("وضعیت تأیید موقعیت نامعتبر است");
  if ((lat != null) !== (lng != null)) throw badRequest("طول و عرض جغرافیایی باید با هم ثبت شوند");
  if (lat != null && (lat < -90 || lat > 90 || lng! < -180 || lng! > 180)) throw badRequest("مختصات خارج از محدوده جهانی است");

  const dup = await db.region.findFirst({
    where: {
      name,
      ...(input.id ? { id: { not: input.id } } : {}),
    },
    select: { id: true, name: true, parent: { select: { name: true } } },
  });
  if (dup) throw badRequest(`منطقه‌ای با نام «${name}»${dup.parent ? ` زیرمجموعه «${dup.parent.name}»` : ""} از قبل ثبت شده است`);

  if (input.parentId) {
    const parent = await db.region.findUnique({ where: { id: input.parentId } });
    if (!parent) throw badRequest("منطقه مادر نامعتبر است");
    if (input.id && input.parentId === input.id) throw badRequest("منطقه مادر نمی‌تواند خود منطقه باشد");
    // prevent cycles: parent must not be a descendant of the region
    if (input.id) {
      const descIds = await regionWithDescendantsIds(input.id);
      if (descIds.includes(input.parentId)) throw badRequest("منطقه مادر نمی‌تواند زیرمجموعه خود منطقه باشد");
    }
  }

  const payload = {
    name,
    altNames: input.altNames?.trim() ?? "",
    type: input.type && input.type in REGION_TYPES ? input.type : "AREA",
    parentId: input.parentId ?? null,
    lat,
    lng,
    geoStatus: input.geoStatus === "VERIFIED" ? "VERIFIED" : "UNVERIFIED",
    isActive: input.isActive ?? true,
    isFeatured: input.isFeatured ?? false,
    sort,
    description: input.description?.trim() ?? "",
  };

  let region;
  if (input.id) {
    region = await db.region.update({ where: { id: input.id }, data: payload });
  } else {
    // unique nameEn with numeric suffix on conflict
    let nameEn = input.nameEn!.trim();
    for (let i = 2; i < 30; i++) {
      const clash = await db.region.findUnique({ where: { nameEn }, select: { id: true } });
      if (!clash) break;
      nameEn = `${input.nameEn!.trim()}-${i}`;
    }
    region = await db.region.create({ data: { ...payload, nameEn } });
  }

  // keep denormalized provinceId consistent
  const root = await (async () => {
    let cur = region.parentId;
    for (let i = 0; cur && i < 10; i++) {
      const parent = await db.region.findUnique({ where: { id: cur }, select: { id: true, type: true, parentId: true } });
      if (!parent) break;
      if (parent.type === "PROVINCE") return parent.id;
      cur = parent.parentId;
    }
    return null;
  })();
  if (root !== region.provinceId) {
    await db.region.update({ where: { id: region.id }, data: { provinceId: root } });
  }

  await audit({
    actorId: user.id,
    action: input.id ? "REGION_UPDATE" : "REGION_CREATE",
    entity: "Region",
    entityId: region.id,
    meta: { name: region.name, nameEn: region.nameEn },
  });
  return region;
}

export async function toggleRegionActive(user: SafeUser, id: string) {
  assertAdmin(user);
  const region = await db.region.findUnique({ where: { id } });
  if (!region) throw notFound("منطقه یافت نشد");
  const updated = await db.region.update({ where: { id }, data: { isActive: !region.isActive } });
  await audit({ actorId: user.id, action: "REGION_TOGGLE", entity: "Region", entityId: id, meta: { isActive: updated.isActive } });
  return updated;
}

export async function deleteRegion(user: SafeUser, id: string) {
  assertAdmin(user);
  const region = await db.region.findUnique({ where: { id }, include: { _count: { select: { children: true, properties: true } } } });
  if (!region) throw notFound("منطقه یافت نشد");
  if (region._count.children > 0) throw badRequest("ابتدا زیرمجموعه‌های این منطقه را حذف یا جابه‌جا کنید");
  if (region._count.properties > 0) throw badRequest("به این منطقه آگهی متصل است؛ می‌توانید آن را غیرفعال کنید");
  await db.region.delete({ where: { id } });
  await audit({ actorId: user.id, action: "REGION_DELETE", entity: "Region", entityId: id, meta: { name: region.name } });
  return { ok: true };
}
