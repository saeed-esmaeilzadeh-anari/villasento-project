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
exports.AuditService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
/** Persist an audit trail entry (never throws into business flow). Port of src/server/audit.ts */
let AuditService = class AuditService {
    prisma;
    logger = new common_1.Logger("Audit");
    constructor(prisma) {
        this.prisma = prisma;
    }
    async audit(opts) {
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
        }
        catch (e) {
            this.logger.error("AUDIT_WRITE_FAILED", e);
        }
    }
};
exports.AuditService = AuditService;
exports.AuditService = AuditService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AuditService);
//# sourceMappingURL=audit.service.js.map