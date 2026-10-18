import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifyToken } from "@/lib/tokens";

// The app pages are for signed-in users only. Everyone else lands on /welcome.
// Public: welcome, sign-up, log-in, about, the texted checkout and login links.
const PUBLIC = [/^\/welcome$/, /^\/signup$/, /^\/login$/, /^\/about$/, /^\/checkout\//, /^\/auth\//];
const SIGNED_OUT_ONLY = [/^\/welcome$/, /^\/login$/];

export function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const signedIn = verifyToken("session", req.cookies.get(SESSION_COOKIE)?.value) !== null;
  if (!signedIn && !PUBLIC.some((re) => re.test(path))) return NextResponse.redirect(new URL("/welcome", req.url));
  if (signedIn && SIGNED_OUT_ONLY.some((re) => re.test(path))) return NextResponse.redirect(new URL("/", req.url));
  return NextResponse.next();
}

export const config = {
  // Pages only: API routes do their own checks, and static files must always load.
  matcher: ["/((?!api|_next/static|_next/image|images/|favicon.ico|robots.txt).*)"],
};
