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
exports.CmsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const public_service_1 = require("../lookups/public.service");
let CmsController = class CmsController {
    publicSrv;
    constructor(publicSrv) {
        this.publicSrv = publicSrv;
    }
    page(slug) {
        if (slug === "all")
            return this.publicSrv.cmsPages();
        return this.publicSrv.cmsPage(slug);
    }
};
exports.CmsController = CmsController;
__decorate([
    (0, common_1.Get)(":slug"),
    (0, swagger_1.ApiOperation)({ summary: "صفحه CMS بر اساس slug (یا all برای فهرست)" }),
    __param(0, (0, common_1.Param)("slug")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CmsController.prototype, "page", null);
exports.CmsController = CmsController = __decorate([
    (0, swagger_1.ApiTags)("public"),
    (0, common_1.Controller)("cms"),
    __metadata("design:paramtypes", [public_service_1.PublicService])
], CmsController);
//# sourceMappingURL=cms.controller.js.map