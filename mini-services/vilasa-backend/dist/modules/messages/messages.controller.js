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
exports.MessagesController = exports.MarkNotificationsReadDto = exports.SendMessageDto = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const swagger_2 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const current_user_decorator_1 = require("../../common/current-user.decorator");
const user_util_1 = require("../../common/user.util");
const messages_service_1 = require("./messages.service");
class SendMessageDto {
    conversationId;
    propertyId;
    text;
}
exports.SendMessageDto = SendMessageDto;
__decorate([
    (0, swagger_2.ApiProperty)({ required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SendMessageDto.prototype, "conversationId", void 0);
__decorate([
    (0, swagger_2.ApiProperty)({ required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SendMessageDto.prototype, "propertyId", void 0);
__decorate([
    (0, swagger_2.ApiProperty)({ minLength: 1, maxLength: 2000 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], SendMessageDto.prototype, "text", void 0);
class MarkNotificationsReadDto {
    ids;
}
exports.MarkNotificationsReadDto = MarkNotificationsReadDto;
__decorate([
    (0, swagger_2.ApiProperty)({ required: false, type: [String] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], MarkNotificationsReadDto.prototype, "ids", void 0);
let MessagesController = class MessagesController {
    messages;
    constructor(messages) {
        this.messages = messages;
    }
    list(user, q) {
        const u = (0, user_util_1.requireUser)(user);
        if (q.conversationId)
            return this.messages.getMessages(u, q.conversationId);
        return this.messages.listConversations(u);
    }
    send(user, dto) {
        return this.messages.sendMessage((0, user_util_1.requireUser)(user), dto.conversationId ?? null, dto.propertyId ?? null, dto.text);
    }
};
exports.MessagesController = MessagesController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: "گفت‌وگوها یا رشته پیام‌ها (?conversationId=)" }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], MessagesController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: "ارسال پیام (گفت‌وگوی موجود یا جدید با propertyId)" }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, SendMessageDto]),
    __metadata("design:returntype", void 0)
], MessagesController.prototype, "send", null);
exports.MessagesController = MessagesController = __decorate([
    (0, swagger_1.ApiTags)("social"),
    (0, common_1.Controller)("messages"),
    __metadata("design:paramtypes", [messages_service_1.MessagesService])
], MessagesController);
//# sourceMappingURL=messages.controller.js.map