/** Re-export auth/session guards for services that should not import route-layer code */
import { forbidden } from "../http";
export { forbidden, notFound, badRequest, unauthorized } from "../http";
export { requireUser } from "../session";
export type { SafeUser } from "../session";
export function requireRoleSafe(role: string, roles: string[]) {
  if (!roles.includes(role)) throw forbidden();
}
