/** Business-logic error with HTTP status — mirrors the Next.js ApiError contract. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export const badRequest = (m: string) => new ApiError(400, m);
export const unauthorized = (m = "برای انجام این عملیات باید وارد حساب خود شوید") => new ApiError(401, m);
export const forbidden = (m = "شما به این بخش دسترسی ندارید") => new ApiError(403, m);
export const notFound = (m = "موردی یافت نشد") => new ApiError(404, m);
