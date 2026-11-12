import { NextResponse } from "next/server";
import { ZodError, ZodType } from "zod";

/** Business-logic error with HTTP status */
export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (m: string) => new ApiError(400, m);
export const unauthorized = (m = "برای انجام این عملیات باید وارد حساب خود شوید") => new ApiError(401, m);
export const forbidden = (m = "شما به این بخش دسترسی ندارید") => new ApiError(403, m);
export const notFound = (m = "موردی یافت نشد") => new ApiError(404, m);

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data as object, init);
}

/** Wraps a route handler with uniform error handling (Persian messages) */
export function handler<Args extends unknown[]>(
  fn: (...args: Args) => Promise<NextResponse>
) {
  return async (...args: Args): Promise<NextResponse> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof ApiError) {
        return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
      }
      if (err instanceof ZodError) {
        const first = err.issues[0];
        return NextResponse.json(
          { error: `اعتبارسنجی ناموفق: ${first?.path?.join(".") ?? ""} ${first?.message ?? ""}`.trim(), issues: err.issues },
          { status: 400 }
        );
      }
      console.error("[API_ERROR]", err);
      return NextResponse.json({ error: "خطای غیرمنتظره سرور. لطفاً دوباره تلاش کنید." }, { status: 500 });
    }
  };
}

/** Parse & validate JSON body with a zod schema */
export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw badRequest("بدنه درخواست نامعتبر است");
  }
  return schema.parse(raw);
}
