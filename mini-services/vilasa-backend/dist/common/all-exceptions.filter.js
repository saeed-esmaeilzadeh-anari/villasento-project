"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllExceptionsFilter = void 0;
const common_1 = require("@nestjs/common");
const api_error_1 = require("./api-error");
/**
 * Uniform error surface — exactly the same JSON shape the Next.js
 * `handler()` wrapper produces:  { error: string, code?: string }
 * so the frontend can point at either backend without any change.
 */
let AllExceptionsFilter = class AllExceptionsFilter {
    catch(exception, host) {
        const res = host.switchToHttp().getResponse();
        if (exception instanceof api_error_1.ApiError) {
            return res.status(exception.status).json({ error: exception.message, code: exception.code });
        }
        // class-validator failures (ValidationPipe → BadRequestException)
        if (exception instanceof common_1.BadRequestException) {
            const r = exception.getResponse();
            const issues = Array.isArray(r?.message) ? r.message : [r?.message ?? exception.message];
            return res.status(400).json({ error: `اعتبارسنجی ناموفق: ${issues[0] ?? ""}`.trim(), issues });
        }
        if (exception instanceof common_1.HttpException) {
            const r = exception.getResponse();
            const message = typeof r === "string" ? r : (r?.message ?? exception.message);
            return res.status(exception.getStatus()).json({ error: message });
        }
        console.error("[API_ERROR]", exception);
        return res.status(500).json({ error: "خطای غیرمنتظره سرور. لطفاً دوباره تلاش کنید." });
    }
};
exports.AllExceptionsFilter = AllExceptionsFilter;
exports.AllExceptionsFilter = AllExceptionsFilter = __decorate([
    (0, common_1.Catch)()
], AllExceptionsFilter);
//# sourceMappingURL=all-exceptions.filter.js.map