"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireUser = requireUser;
exports.assertRole = assertRole;
exports.adminGuard = adminGuard;
const api_error_1 = require("./api-error");
/** Throws 401 unless a user is authenticated (mirrors Next.js requireUser). */
function requireUser(user) {
    if (!user)
        throw (0, api_error_1.unauthorized)();
    return user;
}
/** ADMIN can act anywhere; otherwise exact role match (mirrors requireRole). */
function assertRole(user, ...roles) {
    const u = requireUser(user);
    if (u.role !== "ADMIN" && !roles.includes(u.role))
        throw (0, api_error_1.forbidden)();
    return u;
}
/** Hard admin gate used by the admin module (Persian message parity). */
function adminGuard(user) {
    if (user.role !== "ADMIN")
        throw (0, api_error_1.forbidden)("این بخش فقط برای مدیران سامانه است");
}
//# sourceMappingURL=user.util.js.map