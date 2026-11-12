import { ArgumentsHost, BadRequestException, Catch, ExceptionFilter, HttpException } from "@nestjs/common";
import { Response } from "express";
import { ApiError } from "./api-error";

/**
 * Uniform error surface — exactly the same JSON shape the Next.js
 * `handler()` wrapper produces:  { error: string, code?: string }
 * so the frontend can point at either backend without any change.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof ApiError) {
      return res.status(exception.status).json({ error: exception.message, code: exception.code });
    }

    // class-validator failures (ValidationPipe → BadRequestException)
    if (exception instanceof BadRequestException) {
      const r = exception.getResponse() as { message?: string | string[] };
      const issues = Array.isArray(r?.message) ? r.message : [r?.message ?? exception.message];
      return res.status(400).json({ error: `اعتبارسنجی ناموفق: ${issues[0] ?? ""}`.trim(), issues });
    }

    if (exception instanceof HttpException) {
      const r = exception.getResponse();
      const message = typeof r === "string" ? r : ((r as { message?: string })?.message ?? exception.message);
      return res.status(exception.getStatus()).json({ error: message });
    }

    console.error("[API_ERROR]", exception);
    return res.status(500).json({ error: "خطای غیرمنتظره سرور. لطفاً دوباره تلاش کنید." });
  }
}
