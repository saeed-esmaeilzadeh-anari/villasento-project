"use strict";
/** Domain constants shared across modules (ported from services). */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACTIVE_STATUSES = exports.BOOKING_STATUS = exports.PROPERTY_TYPES = void 0;
exports.PROPERTY_TYPES = {
    VILLA: "ویلا",
    GARDEN_VILLA: "باغ‌ویلا",
    SUITE: "سوئیت و آپارتمان",
    ECO_LODGE: "اقامتگاه بوم‌گردی",
    COTTAGE: "کلبه و چردار",
    APARTMENT: "آپارتمان",
};
exports.BOOKING_STATUS = {
    PENDING_PAYMENT: "PENDING_PAYMENT",
    PENDING_APPROVAL: "PENDING_APPROVAL",
    CONFIRMED: "CONFIRMED",
    COMPLETED: "COMPLETED",
    REJECTED: "REJECTED",
    CANCELLED: "CANCELLED",
    EXPIRED: "EXPIRED",
};
exports.ACTIVE_STATUSES = [
    exports.BOOKING_STATUS.PENDING_PAYMENT,
    exports.BOOKING_STATUS.PENDING_APPROVAL,
    exports.BOOKING_STATUS.CONFIRMED,
];
//# sourceMappingURL=constants.js.map