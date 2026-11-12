import { Injectable, Logger } from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service";

/** Persist an audit trail entry (never throws into business flow). Port of src/server/audit.ts */
@Injectable()
export class AuditService {
  private readonly logger = new Logger("Audit");

  constructor(private prisma: PrismaService) {}

  async audit(opts: {
    actorId?: string | null;
    actorPhone?: string | null;
    action: string;
    entity: string;
    entityId?: string | null;
    meta?: unknown;
  }) {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: opts.actorId ?? null,
          actorPhone: opts.actorPhone ?? null,
          action: opts.action,
          entity: opts.entity,
          entityId: opts.entityId ?? null,
          meta: opts.meta == null ? null : JSON.stringify(opts.meta),
        },
      });
    } catch (e) {
      this.logger.error("AUDIT_WRITE_FAILED", e);
    }
  }
}
