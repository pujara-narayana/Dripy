import "server-only";
import type { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/tokens";
import { startMessage, type AccountRow } from "@/lib/users";

// Demo web session: a signed cookie with the user id (no password). See src/lib/tokens.ts.

export function setSession<T>(res: NextResponse<T>, userId: string): NextResponse<T> {
  res.cookies.set(SESSION_COOKIE, createToken("session", userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}

export function clearSession<T>(res: NextResponse<T>): NextResponse<T> {
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

/** What the web app shows about the signed-in user, incl. how to start the iMessage chat. */
export function publicAccount(user: AccountRow) {
  const body = startMessage(user.id);
  const handle = env.imessageHandle || null;
  return {
    user: { id: user.id, name: user.name, email: user.email, phone: user.phone },
    imessage: { handle, body, url: handle ? `sms:${handle}?&body=${encodeURIComponent(body)}` : null },
  };
}
