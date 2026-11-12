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
exports.PropertiesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_1 = require("../../common/current-user.decorator");
const user_util_1 = require("../../common/user.util");
const properties_service_1 = require("./properties.service");
const properties_dto_1 = require("./properties.dto");
let PropertiesController = class PropertiesController {
    props;
    constructor(props) {
        this.props = props;
    }
    search(q) {
        const num = (v) => {
            if (v == null || v === "")
                return undefined;
            const n = Number(v);
            return Number.isFinite(n) ? n : undefined;
        };
        return this.props.searchProperties({
            q: q.q || undefined,
            cityId: q.cityId || undefined,
            provinceId: q.provinceId || undefined,
            checkIn: q.checkIn || undefined,
            checkOut: q.checkOut || undefined,
            adults: num(q.adults),
            children: num(q.children),
            minPrice: num(q.minPrice),
            maxPrice: num(q.maxPrice),
            amenities: q.amenities ? q.amenities.split(",").filter(Boolean) : undefined,
            types: q.types ? q.types.split(",").filter(Boolean) : undefined,
            instantOnly: q.instantOnly === "1",
            featuredOnly: q.featuredOnly === "1",
            sort: q.sort || undefined,
            page: num(q.page) ?? 1,
            pageSize: num(q.pageSize) ?? 9,
        });
    }
    create(user, dto) {
        return this.props.createProperty((0, user_util_1.requireUser)(user), dto);
    }
    detail(user, id) {
        return this.props.propertyDetail(id, user);
    }
    update(user, id, dto) {
        return this.props.updateProperty((0, user_util_1.requireUser)(user), id, dto);
    }
    remove(user, id) {
        return this.props.deleteProperty((0, user_util_1.requireUser)(user), id);
    }
};
exports.PropertiesController = PropertiesController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: "جستجوی اقامتگاه‌ها با فیلترهای واقعی دیتابیس" }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PropertiesController.prototype, "search", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: "ثبت اقامتگاه جدید توسط میزبان" }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, properties_dto_1.CreatePropertyDto]),
    __metadata("design:returntype", void 0)
], PropertiesController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(":id"),
    (0, swagger_1.ApiOperation)({ summary: "جزئیات اقامتگاه + تقویم + نظرات" }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PropertiesController.prototype, "detail", null);
__decorate([
    (0, common_1.Patch)(":id"),
    (0, swagger_1.ApiOperation)({ summary: "ویرایش اقامتگاه توسط میزبان" }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, properties_dto_1.UpdatePropertyDto]),
    __metadata("design:returntype", void 0)
], PropertiesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(":id"),
    (0, swagger_1.ApiOperation)({ summary: "حذف اقامتگاه (در صورت نبود رزرو فعال)" }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PropertiesController.prototype, "remove", null);
exports.PropertiesController = PropertiesController = __decorate([
    (0, swagger_1.ApiTags)("properties"),
    (0, common_1.Controller)("properties"),
    __metadata("design:paramtypes", [properties_service_1.PropertiesService])
], PropertiesController);
//# sourceMappingURL=properties.controller.js.map