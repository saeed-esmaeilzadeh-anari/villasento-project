import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";

/**
 * Password hashing — bcrypt (bcryptjs, cost 12) for NEW hashes.
 * Legacy scrypt hashes (format: scrypt$salt$hash) still verify, and are
 * transparently re-hashed to bcrypt on successful login (see auth service).
 * Both algorithms are memory-hard KDFs; bcrypt was requested for the
 * standard salted-hash format and wide tooling support.
 */

const BCRYPT_ROUNDS = 12;

/** Hash a password — returns a bcrypt hash ($2a$12$...) */
export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, BCRYPT_ROUNDS);
}

/** Verify a password against a stored bcrypt OR legacy scrypt hash */
export function verifyPassword(plain: string, stored: string | null): boolean {
  if (!stored) return false;
  try {
    if (stored.startsWith("$2a$") || stored.startsWith("$2b$") || stored.startsWith("$2y$")) {
      return bcrypt.compareSync(plain, stored);
    }
    if (stored.startsWith("scrypt$")) {
      const parts = stored.split("$");
      if (parts.length !== 3) return false;
      const salt = Buffer.from(parts[1], "hex");
      const expected = Buffer.from(parts[2], "hex");
      const actual = scryptSync(plain, salt, expected.length, { N: 16384, r: 8, p: 1 });
      return expected.length === actual.length && timingSafeEqual(expected, actual);
    }
    return false;
  } catch {
    return false;
  }
}

/** Is the stored hash a legacy (non-bcrypt) hash that should be re-hashed on login? */
export function needsRehash(stored: string | null): boolean {
  return !!stored && !stored.startsWith("$2");
}

export function passwordPolicyError(pw: string, minLength = 6): string | null {
  if (!pw || pw.length < minLength) return `رمز عبور باید حداقل ${minLength} نویسه باشد`;
  if (pw.length > 72) return "رمز عبور حداکثر ۷۲ نویسه است";
  if (!/^[!-~\u0600-\u06FF ]+$/.test(pw)) return "رمز عبور شامل نویسه‌های مجاز نیست";
  return null;
}
