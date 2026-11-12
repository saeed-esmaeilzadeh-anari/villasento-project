"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SESSION_MAX_AGE = exports.COOKIE_NAME = void 0;
exports.decodeSession = decodeSession;
exports.createSessionToken = createSessionToken;
exports.extractTokenFromCookies = extractTokenFromCookies;
const crypto_1 = require("crypto");
/**
 * Stateless signed-cookie session (HMAC-SHA256) — byte-for-byte compatible
 * with the Next.js implementation (src/server/session.ts). A session created
 * by either server is valid on the other one (same cookie & secret).
 */
exports.COOKIE_NAME = "vilasa_session";
exports.SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
function secret() {
    return process.env.AUTH_SECRET || "vilasa-dev-secret-do-not-use-in-prod";
}
function sign(data) {
    return (0, crypto_1.createHmac)("sha256", secret()).update(data).digest("base64url");
}
function encode(payload) {
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return `${body}.${sign(body)}`;
}
function decodeSession(token) {
    const dot = token.lastIndexOf(".");
    if (dot <= 0)
        return null;
    const body = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expected = sign(body);
    try {
        const a = Buffer.from(sig);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !(0, crypto_1.timingSafeEqual)(a, b))
            return null;
        const payload = JSON.parse(Buffer.from(body, "base64url").toString());
        if (payload.exp * 1000 < Date.now())
            return null; // exp is in seconds
        return payload;
    }
    catch {
        return null;
    }
}
function createSessionToken(userId, role) {
    const now = Math.floor(Date.now() / 1000);
    return encode({ uid: userId, role, iat: now, exp: now + exports.SESSION_MAX_AGE });
}
/** Extract the raw session token from a Cookie header value map. */
function extractTokenFromCookies(cookies) {
    return cookies?.[exports.COOKIE_NAME] ?? null;
}
//# sourceMappingURL=session.util.js.map