import { NextResponse } from "next/server";
import { fail, fallbackToMock, readJson } from "@/lib/http";
import { publicAccount, setSession } from "@/lib/session";
import type { Gender } from "@/data/catalog";
import { signUp, SignupRejected } from "@/lib/users";

// POST /api/auth/signup {name, email, phone, gender: "women"|"men"} -> {user, imessage, created} + session cookie.
// An existing phone number signs in to that account instead of creating a second one.
export async function POST(req: Request) {
  if (fallbackToMock()) return fail(503, "Sign-up needs the database (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).");
  try {
    const body = await readJson(req);
    const { user, created } = await signUp({
      name: String(body.name ?? ""),
      email: String(body.email ?? ""),
      phone: String(body.phone ?? ""),
      gender: body.gender as Gender,
    });
    return setSession(NextResponse.json({ ...publicAccount(user), created }), user.id);
  } catch (err) {
    if (err instanceof SignupRejected) return fail(422, err.message);
    console.error(err);
    return fail(500, "Sign-up failed. Try again in a moment.");
  }
}
