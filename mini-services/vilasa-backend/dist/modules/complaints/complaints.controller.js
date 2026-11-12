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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComplaintsController = exports.CreateComplaintDto = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const swagger_2 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const current_user_decorator_1 = require("../../common/current-user.decorator");
const user_util_1 = require("../../common/user.util");
const prisma_service_1 = require("../../prisma/prisma.service");
const complaints_service_1 = require("./complaints.service");
class CreateComplaintDto {
    bookingId;
    subject;
    body;
}
exports.CreateComplaintDto = CreateComplaintDto;
__decorate([
    (0, swagger_2.ApiProperty)({ required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateComplaintDto.prototype, "bookingId", void 0);
__decorate([
    (0, swagger_2.ApiProperty)({ minLength: 2, maxLength: 120 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], CreateComplaintDto.prototype, "subject", void 0);
__decorate([
    (0, swagger_2.ApiProperty)({ minLength: 5, maxLength: 3000 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(5),
    (0, class_validator_1.MaxLength)(3000),
    __metadata("design:type", String)
], CreateComplaintDto.prototype, "body", void 0);
let ComplaintsController = class ComplaintsController {
    complaints;
    prisma;
    constructor(complaints, prisma) {
        this.complaints = complaints;
        this.prisma = prisma;
    }
    create(user, dto) {
        return this.complaints.createComplaint((0, user_util_1.requireUser)(user).id, dto);
    }
    async mine(user) {
        const u = (0, user_util_1.requireUser)(user);
        return this.prisma.complaint.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" } });
    }
};
exports.ComplaintsController = ComplaintsController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: "ثبت شکایت/تیکت پشتیبانی" }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, CreateComplaintDto]),
    __metadata("design:returntype", void 0)
], ComplaintsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: "شکایات من" }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ComplaintsController.prototype, "mine", null);
exports.ComplaintsController = ComplaintsController = __decorate([
    (0, swagger_1.ApiTags)("social"),
    (0, common_1.Controller)("complaints"),
    __metadata("design:paramtypes", [complaints_service_1.ComplaintsService,
        prisma_service_1.PrismaService])
], ComplaintsController);
//# sourceMappingURL=complaints.controller.js.map