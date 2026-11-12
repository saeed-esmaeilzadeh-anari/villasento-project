/** Domain constants shared across modules (ported from services). */

export const PROPERTY_TYPES: Record<string, string> = {
  VILLA: "ویلا",
  GARDEN_VILLA: "باغ‌ویلا",
  SUITE: "سوئیت و آپارتمان",
  ECO_LODGE: "اقامتگاه بوم‌گردی",
  COTTAGE: "کلبه و چردار",
  APARTMENT: "آپارتمان",
};

export const BOOKING_STATUS = {
  PENDING_PAYMENT: "PENDING_PAYMENT",
  PENDING_APPROVAL: "PENDING_APPROVAL",
  CONFIRMED: "CONFIRMED",
  COMPLETED: "COMPLETED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
} as const;

export const ACTIVE_STATUSES = [
  BOOKING_STATUS.PENDING_PAYMENT,
  BOOKING_STATUS.PENDING_APPROVAL,
  BOOKING_STATUS.CONFIRMED,
];
