"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFound = exports.forbidden = exports.unauthorized = exports.badRequest = exports.ApiError = void 0;
/** Business-logic error with HTTP status — mirrors the Next.js ApiError contract. */
class ApiError extends Error {
    status;
    code;
    constructor(status, message, code) {
        super(message);
        this.status = status;
        this.code = code;
    }
}
exports.ApiError = ApiError;
const badRequest = (m) => new ApiError(400, m);
exports.badRequest = badRequest;
const unauthorized = (m = "برای انجام این عملیات باید وارد حساب خود شوید") => new ApiError(401, m);
exports.unauthorized = unauthorized;
const forbidden = (m = "شما به این بخش دسترسی ندارید") => new ApiError(403, m);
exports.forbidden = forbidden;
const notFound = (m = "موردی یافت نشد") => new ApiError(404, m);
exports.notFound = notFound;
//# sourceMappingURL=api-error.js.map