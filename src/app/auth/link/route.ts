import { NextResponse, type NextRequest } from "next/server";
import { setSession } from "@/lib/session";
import { verifyToken } from "@/lib/tokens";

// GET /auth/link?t=<login token> — the wardrobe link in Dripy's iMessage greeting.
// Signs the phone's browser in and opens the closet.
export function GET(req: NextRequest) {
  const userId = verifyToken("login", req.nextUrl.searchParams.get("t"));
  if (!userId) return NextResponse.redirect(new URL("/login?expired=1", req.url));
  return setSession(NextResponse.redirect(new URL("/", req.url)), userId);
}
