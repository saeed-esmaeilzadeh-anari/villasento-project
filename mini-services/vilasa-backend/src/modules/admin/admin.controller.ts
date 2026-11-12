import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../../common/current-user.decorator";
import { requireUser } from "../../common/user.util";
import { badRequest } from "../../common/api-error";
import type { SafeUser } from "../../common/session.middleware";
import { AdminService } from "./admin.service";
import { AdminActionDto } from "../bookings/bookings.dto";

@ApiTags("admin")
@Controller("admin")
export class AdminController {
  constructor(private admin: AdminService) {}

  /**
   * GET /api/admin/[section]
   * sections: overview | reports | users | properties | bookings | payments |
   *           refunds | payouts | coupons | complaints | reviews | settings | audit
   */
  @Get(":section")
  async section(
    @CurrentUser() user: SafeUser | null,
    @Param("section") section: string,
    @Query("days") days?: string,
    @Query("q") q?: string,
    @Query("role") role?: string,
    @Query("status") status?: string,
  ) {
    const u = requireUser(user);
    switch (section) {
      case "overview":
        return this.admin.overview(u);
      case "reports":
        return this.admin.reports(u, Number(days ?? 30));
      case "users":
        return this.admin.listUsers(u, q ?? undefined, role ?? undefined);
      case "properties":
        return this.admin.adminProperties(u, status ?? "ALL");
      case "bookings":
        return this.admin.adminBookings(u, status ?? "ALL", q ?? undefined);
      case "payments":
        return this.admin.adminPayments(u);
      case "refunds":
        return this.admin.adminRefunds(u);
      case "payouts":
        return this.admin.adminPayouts(u);
      case "coupons":
        return this.admin.adminCoupons(u);
      case "complaints":
        return this.admin.adminComplaints(u);
      case "reviews":
        return this.admin.adminReviews(u, status ?? "ALL");
      case "settings":
        return this.admin.getSettings(u);
      case "audit":
        return this.admin.getAuditLogs(u);
      default:
        throw badRequest("بخش نامعتبر است");
    }
  }

  /** POST /api/admin/[section] — action dispatch */
  @Post(":section")
  @HttpCode(HttpStatus.OK)
  async action(
    @CurrentUser() user: SafeUser | null,
    @Param("section") section: string,
    @Body() body: AdminActionDto,
  ) {
    const u = requireUser(user);
    const id = body.id;

    switch (section) {
      case "users": {
        if (body.action === "toggle-block") return this.admin.toggleUserBlock(u, id!);
        if (body.action === "set-role") return this.admin.setUserRole(u, id!, body.role!);
        break;
      }
      case "properties": {
        if (body.action === "approve") return this.admin.verifyProperty(u, id!, "APPROVE");
        if (body.action === "reject") return this.admin.verifyProperty(u, id!, "REJECT", body.reason);
        if (body.action === "toggle-featured") return this.admin.toggleFeatured(u, id!);
        if (body.action === "toggle-suspend") return this.admin.suspendProperty(u, id!);
        break;
      }
      case "refunds": {
        if (body.action === "process") return this.admin.processRefund(u, id!);
        break;
      }
      case "payouts": {
        if (body.action === "create")
          return this.admin.createPayout(u, body.hostId!, body.amount!, body.periodLabel ?? "تسویه دوره‌ای");
        if (body.action === "mark-paid") return this.admin.markPayoutPaid(u, id!);
        break;
      }
      case "coupons": {
        if (body.action === "upsert")
          return this.admin.upsertCoupon(u, body.data as never);
        if (body.action === "delete") return this.admin.deleteCoupon(u, id!);
        break;
      }
      case "complaints": {
        if (body.action === "reply")
          return this.admin.replyComplaint(u, id!, body.reply ?? "", body.status ?? "RESOLVED");
        break;
      }
      case "reviews": {
        if (body.action === "moderate") return this.admin.moderateReview(u, id!, body.status ?? "APPROVED");
        break;
      }
      case "settings": {
        if (body.action === "update") return this.admin.updateSettings(u, body.data as Record<string, string>);
        break;
      }
    }
    throw badRequest("عملیات ناشناخته");
  }
}
