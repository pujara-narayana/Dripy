import { NextResponse } from "next/server";
import { clearSession } from "@/lib/session";

// POST /api/auth/logout -> clears the session cookie.
export async function POST() {
  return clearSession(NextResponse.json({ ok: true }));
}
