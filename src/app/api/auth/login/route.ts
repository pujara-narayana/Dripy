import { NextResponse } from "next/server";
import { fail, fallbackToMock, readJson } from "@/lib/http";
import { publicAccount, setSession } from "@/lib/session";
import { logIn, SignupRejected } from "@/lib/users";

// POST /api/auth/login {phone} -> {user, imessage} + session cookie. Demo only: no password.
export async function POST(req: Request) {
  if (fallbackToMock()) return fail(503, "Log-in needs the database (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).");
  try {
    const body = await readJson(req);
    const user = await logIn(String(body.phone ?? ""));
    return setSession(NextResponse.json(publicAccount(user)), user.id);
  } catch (err) {
    if (err instanceof SignupRejected) return fail(422, err.message);
    console.error(err);
    return fail(500, "Log-in failed. Try again in a moment.");
  }
}
