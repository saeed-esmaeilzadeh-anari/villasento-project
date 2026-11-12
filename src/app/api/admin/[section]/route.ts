import { NextResponse } from "next/server";
import { handler, ok, parseBody, badRequest } from "@/server/http";
import { requireUser } from "@/server/session";
import * as Admin from "@/server/services/admin";
import * as Stats from "@/server/services/stats";
import * as Users from "@/server/services/users";
import * as Visits from "@/server/services/visits";
import * as Contact from "@/server/services/contact";
import * as Content from "@/server/services/content";
import * as Props from "@/server/services/properties";
import { z } from "zod";

type Ctx = { params: Promise<{ section: string }> };

/**
 * GET /api/admin/[section]
 * overview | charts | recents | users | properties | visits | messages | complaints |
 * agents | articles | banners | faqs | cms | settings | audit | export
 */
export const GET = handler(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { section } = await ctx.params;
  const sp = new URL(req.url).searchParams;

  switch (section) {
    case "overview": return ok(await Stats.overview(user));
    case "charts": return ok(await Stats.charts(user, Number(sp.get("days") ?? 30) || 30));
    case "recents": return ok(await Stats.recents(user));
    case "users": return ok(await Users.listUsers(user, sp.get("q") ?? undefined, sp.get("role") ?? undefined, Number(sp.get("page") ?? 1) || 1));
    case "user": return ok(await Users.userDetail(user, sp.get("id") ?? ""));
    case "properties": return ok({ items: await Admin.adminProperties(user, { status: sp.get("status") ?? "ALL", q: sp.get("q") ?? undefined, tt: sp.get("tt") ?? undefined }) });
    case "visits": return ok({ items: await Visits.adminVisits(user, sp.get("status") ?? "ALL") });
    case "messages": return ok({ items: await Contact.adminMessages(user, sp.get("status") ?? "ALL") });
    case "complaints": return ok({ items: await Admin.adminComplaints(user, sp.get("type") ?? "ALL") });
    case "agents": return ok({ items: await Users.listAgents(user) });
    case "articles": return ok({ items: await Content.adminArticles(user) });
    case "banners": return ok({ items: await Content.adminBanners(user) });
    case "faqs": return ok({ items: await Content.adminFaqs(user) });
    case "cms": return ok({ items: await Content.adminCmsPages(user) });
    case "settings": return ok(await Admin.getSettings(user));
    case "audit": return ok({ items: await Admin.getAuditLogs(user, sp.get("q") ?? undefined) });
    case "export": {
      const res = await Users.exportCsv(user, sp.get("entity") ?? "listings");
      return new NextResponse(res.csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${res.filename}"`,
        },
      });
    }
    default: throw badRequest("بخش نامعتبر است");
  }
});

const actionSchema = z.object({
  action: z.string(),
  id: z.string().optional(),
  reason: z.string().optional(),
  status: z.string().optional(),
  to: z.string().optional(),
  featured: z.boolean().optional(),
  role: z.string().optional(),
  agentId: z.string().nullable().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  reply: z.string().optional(),
});

/** POST /api/admin/[section] — action dispatch */
export const POST = handler(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { section } = await ctx.params;
  const body = await parseBody(req, actionSchema);
  const id = body.id ?? "";

  switch (section) {
    case "properties": {
      if (body.action === "set-status") return ok(await Admin.setListingStatus(user, id, body.to ?? body.status!, body.reason, body.featured));
      if (body.action === "approve") return ok(await Admin.setListingStatus(user, id, "PUBLISHED"));
      if (body.action === "approve-private") return ok(await Admin.setListingStatus(user, id, "APPROVED"));
      if (body.action === "reject") return ok(await Admin.setListingStatus(user, id, "REJECTED", body.reason));
      if (body.action === "publish") return ok(await Admin.setListingStatus(user, id, "PUBLISHED"));
      if (body.action === "unpublish") return ok(await Admin.setListingStatus(user, id, "APPROVED"));
      if (body.action === "archive") return ok(await Admin.setListingStatus(user, id, "ARCHIVED"));
      if (body.action === "toggle-featured") return ok(await Admin.toggleFeatured(user, id));
      if (body.action === "assign-agent") return ok(await Users.assignAgent(user, id, body.agentId ?? null));
      if (body.action === "delete") return ok(await Admin.adminDeleteProperty(user, id));
      break;
    }
    case "users": {
      if (body.action === "toggle-block") return ok(await Users.toggleUserBlock(user, id));
      if (body.action === "set-role") return ok(await Users.setUserRole(user, id, body.role!));
      break;
    }
    case "agents": {
      if (body.action === "upsert") return ok(await Users.upsertAgent(user, body.data as never));
      if (body.action === "toggle-active") return ok(await Users.toggleAgentActive(user, id));
      break;
    }
    case "visits": {
      if (body.action === "update") return ok(await Visits.adminUpdateVisit(user, id, body.data as never));
      break;
    }
    case "messages": {
      if (body.action === "update") return ok(await Contact.adminUpdateMessage(user, id, body.data as never));
      break;
    }
    case "complaints": {
      if (body.action === "reply") return ok(await Admin.replyComplaint(user, id, body.reply ?? "", body.status ?? "RESOLVED"));
      break;
    }
    case "articles": {
      if (body.action === "upsert") return ok(await Content.upsertArticle(user, body.data as never));
      if (body.action === "delete") return ok(await Content.deleteArticle(user, id));
      if (body.action === "upsert-category") return ok(await Content.upsertArticleCategory(user, body.data as never));
      break;
    }
    case "banners": {
      if (body.action === "upsert") return ok(await Content.upsertBanner(user, body.data as never));
      if (body.action === "delete") return ok(await Content.deleteBanner(user, id));
      break;
    }
    case "faqs": {
      if (body.action === "upsert") return ok(await Content.upsertFaq(user, body.data as never));
      if (body.action === "delete") return ok(await Content.deleteFaq(user, id));
      break;
    }
    case "cms": {
      if (body.action === "upsert") return ok(await Content.upsertCmsPage(user, body.data as never));
      if (body.action === "delete") return ok(await Content.deleteCmsPage(user, id));
      break;
    }
    case "settings": {
      if (body.action === "update") return ok(await Admin.updateSettings(user, body.data as Record<string, string>));
      break;
    }
  }
  throw badRequest("عملیات ناشناخته");
});
