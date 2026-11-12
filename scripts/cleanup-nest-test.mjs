/** One-off cleanup of NestJS E2E test residue from the shared dev database. */
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

(async () => {
  const cutoff = new Date("2026-11-04T11:55:00.000Z");

  const junk = await p.booking.findMany({
    where: {
      OR: [
        { status: "PENDING_PAYMENT", createdAt: { gte: cutoff } },
        { cancelReason: "تست خودکار بک‌اند", createdAt: { gte: cutoff } },
      ],
    },
    select: { id: true, code: true },
  });
  const ids = junk.map((b) => b.id);
  if (ids.length) {
    await p.bookingEvent.deleteMany({ where: { bookingId: { in: ids } } });
    await p.couponUsage.deleteMany({ where: { bookingId: { in: ids } } });
    await p.booking.deleteMany({ where: { id: { in: ids } } });
  }
  await p.$executeRawUnsafe(
    `UPDATE Coupon SET usedCount = (SELECT COUNT(*) FROM CouponUsage WHERE couponId = Coupon.id)`,
  );
  console.log("deleted junk bookings:", junk.length, junk.map((b) => b.code).join(", "));

  const c = await p.complaint.deleteMany({ where: { subject: "تست بک‌اند NestJS" } });
  const m = await p.message.deleteMany({ where: { text: "سلام، از NestJS!" } });
  const n = await p.notification.deleteMany({
    where: { createdAt: { gte: cutoff }, title: { in: ["درخواست رزرو جدید", "پیام جدید"] } },
  });
  const emptyConvs = await p.conversation.findMany({
    where: { messages: { none: {} }, lastMessageAt: { gte: cutoff } },
    select: { id: true },
  });
  await p.conversation.deleteMany({ where: { id: { in: emptyConvs.map((x) => x.id) } } });
  console.log("complaints:", c.count, "messages:", m.count, "notifications:", n.count, "emptyConvs:", emptyConvs.length);

  await p.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
