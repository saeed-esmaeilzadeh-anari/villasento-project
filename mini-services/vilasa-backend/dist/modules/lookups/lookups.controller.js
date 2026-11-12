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
exports.LookupsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const public_service_1 = require("./public.service");
let LookupsController = class LookupsController {
    publicSrv;
    constructor(publicSrv) {
        this.publicSrv = publicSrv;
    }
    lookups() {
        return this.publicSrv.lookups();
    }
};
exports.LookupsController = LookupsController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: "استان‌ها/شهرها، امکانات و انواع اقامتگاه" }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LookupsController.prototype, "lookups", null);
exports.LookupsController = LookupsController = __decorate([
    (0, swagger_1.ApiTags)("public"),
    (0, common_1.Controller)("lookups"),
    __metadata("design:paramtypes", [public_service_1.PublicService])
], LookupsController);
//# sourceMappingURL=lookups.controller.js.map