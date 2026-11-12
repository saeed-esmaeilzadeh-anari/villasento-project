import { createHmac, timingSafeEqual } from "crypto";

/**
 * Stateless signed-cookie session (HMAC-SHA256) — byte-for-byte compatible
 * with the Next.js implementation (src/server/session.ts). A session created
 * by either server is valid on the other one (same cookie & secret).
 */

export const COOKIE_NAME = "vilasa_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export type SessionPayload = { uid: string; role: string; iat: number; exp: number };

function secret(): string {
  return process.env.AUTH_SECRET || "vilasa-dev-secret-do-not-use-in-prod";
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

function encode(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function decodeSession(token: string): SessionPayload | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(body);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    if (payload.exp * 1000 < Date.now()) return null; // exp is in seconds
    return payload;
  } catch {
    return null;
  }
}

export function createSessionToken(userId: string, role: string): string {
  const now = Math.floor(Date.now() / 1000);
  return encode({ uid: userId, role, iat: now, exp: now + SESSION_MAX_AGE });
}

/** Extract the raw session token from a Cookie header value map. */
export function extractTokenFromCookies(cookies: Record<string, string> | undefined): string | null {
  return cookies?.[COOKIE_NAME] ?? null;
}
