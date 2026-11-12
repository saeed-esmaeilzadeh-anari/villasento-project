import { unauthorized, forbidden } from "./api-error";
import type { SafeUser } from "./session.middleware";

/** Throws 401 unless a user is authenticated (mirrors Next.js requireUser). */
export function requireUser(user: SafeUser | null): SafeUser {
  if (!user) throw unauthorized();
  return user;
}

/** ADMIN can act anywhere; otherwise exact role match (mirrors requireRole). */
export function assertRole(user: SafeUser | null, ...roles: string[]): SafeUser {
  const u = requireUser(user);
  if (u.role !== "ADMIN" && !roles.includes(u.role)) throw forbidden();
  return u;
}

/** Hard admin gate used by the admin module (Persian message parity). */
export function adminGuard(user: SafeUser) {
  if (user.role !== "ADMIN") throw forbidden("این بخش فقط برای مدیران سامانه است");
}
