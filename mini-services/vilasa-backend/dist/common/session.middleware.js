"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionMiddleware = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const session_util_1 = require("./session.util");
/**
 * Resolves the shared `vilasa_session` HMAC cookie on every request —
 * identical algorithm & secret to the Next.js app → a login performed on
 * either server is automatically valid on the other (SSO).
 */
let SessionMiddleware = class SessionMiddleware {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async use(req, _res, next) {
        req.vilasaUser = null;
        const token = (0, session_util_1.extractTokenFromCookies)(req.cookies);
        if (token) {
            const payload = (0, session_util_1.decodeSession)(token);
            if (payload) {
                const user = await this.prisma.user.findUnique({ where: { id: payload.uid } });
                if (user && !user.isBlocked) {
                    req.vilasaUser = {
                        id: user.id,
                        phone: user.phone,
                        fullName: user.fullName,
                        email: user.email,
                        role: user.role,
                        isHostVerified: user.isHostVerified,
                        isBlocked: user.isBlocked,
                        avatarUrl: user.avatarUrl,
                        nationalId: user.nationalId,
                    };
                }
            }
        }
        next();
    }
};
exports.SessionMiddleware = SessionMiddleware;
exports.SessionMiddleware = SessionMiddleware = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SessionMiddleware);
//# sourceMappingURL=session.middleware.js.map