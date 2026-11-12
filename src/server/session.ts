import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { forbidden, unauthorized } from "./http";

/**
 * Stateless signed-cookie session (HMAC-SHA256).
 * Designed so it can be swapped for JWT/refresh-rotation in production
 * without touching any service code (only this file).
 */

const COOKIE_NAME = "villasento_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  return process.env.AUTH_SECRET || "vilasa-dev-secret-do-not-use-in-prod";
}

export type SessionPayload = { uid: string; role: string; iat: number; exp: number };

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

function encode(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decode(token: string): SessionPayload | null {
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

export async function createSession(userId: string, role: string) {
  const now = Math.floor(Date.now() / 1000);
  const token = encode({ uid: userId, role, iat: now, exp: now + MAX_AGE });
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export type SafeUser = {
  id: string; phone: string; fullName: string | null; email: string | null;
  role: string; isHostVerified: boolean; isBlocked: boolean; avatarUrl: string | null;
  nationalId: string | null; hasPassword: boolean;
};

export async function getCurrentUser(): Promise<SafeUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = decode(token);
  if (!payload) return null;
  const user = await db.user.findUnique({ where: { id: payload.uid } });
  if (!user || user.isBlocked) return null;
  return {
    id: user.id, phone: user.phone, fullName: user.fullName, email: user.email,
    role: user.role, isHostVerified: user.isHostVerified, isBlocked: user.isBlocked,
    avatarUrl: user.avatarUrl, nationalId: user.nationalId,
    hasPassword: !!user.passwordHash,
  };
}

export async function requireUser(): Promise<SafeUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  return user;
}

export async function requireRole(...roles: string[]): Promise<SafeUser> {
  const user = await requireUser();
  // ADMIN / SUPER_ADMIN can act anywhere; otherwise exact role match
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN" && !roles.includes(user.role)) throw forbidden();
  return user;
}
