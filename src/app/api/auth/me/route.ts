import { connection, NextResponse } from "next/server";
import { fail, fallbackToMock } from "@/lib/http";
import { clearSession, publicAccount } from "@/lib/session";
import { sessionUserFromCookieHeader } from "@/lib/tokens";
import { getAccount } from "@/lib/users";

// GET /api/auth/me -> {user, imessage} for the signed-in user, 401 otherwise.
export async function GET(req: Request) {
  await connection();
  const userId = sessionUserFromCookieHeader(req.headers.get("cookie"));
  if (!userId) return fail(401, "not signed in");
  if (fallbackToMock()) return fail(503, "needs the database");
  const user = await getAccount(userId);
  if (!user) return clearSession(NextResponse.json({ error: "account not found" }, { status: 401 }));
  return NextResponse.json(publicAccount(user));
}
