import { db } from "@/lib/db";

/** Persist an audit trail entry (never throws into business flow) */
export async function audit(opts: {
  actorId?: string | null;
  actorPhone?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  meta?: unknown;
}) {
  try {
    await db.auditLog.create({
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
    console.error("[AUDIT_WRITE_FAILED]", e);
  }
}
