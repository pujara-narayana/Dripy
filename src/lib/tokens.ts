import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

// Signed, expiring tokens for the demo session cookie and the links Dripy texts people
// (card checkout, wardrobe login). Format: base64url(kind.subject.expiresAt).signature
// No server-only import: proxy.ts verifies session cookies with this too.

export type TokenKind = "session" | "checkout" | "login";

const TTL_SECONDS: Record<TokenKind, number> = {
  session: 30 * 24 * 3600,
  checkout: 24 * 3600,
  login: 7 * 24 * 3600,
};

const sign = (data: string) => createHmac("sha256", env.sessionSecret).update(data).digest("base64url");

export function createToken(kind: TokenKind, subject: string): string {
  const data = Buffer.from(`${kind}.${subject}.${Math.floor(Date.now() / 1000) + TTL_SECONDS[kind]}`).toString("base64url");
  return `${data}.${sign(data)}`;
}

/** The subject (user or intent id) if the token is valid, of this kind and unexpired. */
export function verifyToken(kind: TokenKind, token: string | null | undefined): string | null {
  if (!token) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  const expected = Buffer.from(sign(data));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const [k, subject, exp] = Buffer.from(data, "base64url").toString().split(".");
  if (k !== kind || !subject || !(Number(exp) > Date.now() / 1000)) return null;
  return subject;
}

export const SESSION_COOKIE = "dripy_session";
export const SESSION_MAX_AGE = TTL_SECONDS.session;

/** The signed-in user id from a Cookie header, or null. */
export function sessionUserFromCookieHeader(header: string | null): string | null {
  const raw = header
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  return verifyToken("session", raw ? decodeURIComponent(raw) : null);
}
