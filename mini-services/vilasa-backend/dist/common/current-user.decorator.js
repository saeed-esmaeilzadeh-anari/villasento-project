"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrentUser = void 0;
const common_1 = require("@nestjs/common");
/** Resolves the current user set by SessionMiddleware (null when anonymous). */
exports.CurrentUser = (0, common_1.createParamDecorator)((_data, ctx) => {
    const req = ctx.switchToHttp().getRequest();
    return req.vilasaUser ?? null;
});
//# sourceMappingURL=current-user.decorator.js.map