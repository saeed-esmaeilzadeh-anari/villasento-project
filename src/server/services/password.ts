import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

/**
 * Password hashing with Node's built-in scrypt (no external dependency).
 * Format: scrypt$<salt-hex>$<hash-hex>
 */
export function hashPassword(plain: string): string {
  const saltHex = randomBytes(16).toString("hex");
  const hash = scryptSync(plain, Buffer.from(saltHex, "hex"), 64, { N: 16384, r: 8, p: 1 }).toString("hex");
  return `scrypt$${saltHex}$${hash}`;
}

export function verifyPassword(plain: string, stored: string | null): boolean {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  try {
    const salt = Buffer.from(parts[1], "hex");
    const expected = Buffer.from(parts[2], "hex");
    const actual = scryptSync(plain, salt, expected.length, { N: 16384, r: 8, p: 1 });
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function passwordPolicyError(pw: string): string | null {
  if (!pw || pw.length < 6) return "رمز عبور باید حداقل ۶ نویسه باشد";
  if (pw.length > 72) return "رمز عبور حداکثر ۷۲ نویسه است";
  if (!/^[!-~\u0600-\u06FF ]+$/.test(pw)) return "رمز عبور شامل نویسه‌های مجاز نیست";
  return null;
}
