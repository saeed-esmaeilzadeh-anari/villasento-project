import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { VilasaRequest } from "./session.middleware";

/** Resolves the current user set by SessionMiddleware (null when anonymous). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): VilasaRequest["vilasaUser"] => {
    const req = ctx.switchToHttp().getRequest<VilasaRequest>();
    return req.vilasaUser ?? null;
  },
);
