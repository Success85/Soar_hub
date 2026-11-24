import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/dashboard", "/applications", "/planner", "/documents", "/essays", "/answer-bank", "/referees", "/notifications", "/profile", "/settings", "/onboarding", "/eligibility", "/learn", "/admin", "/reviewer"];

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const hasSession = req.cookies.has("__Host-soar_session") || req.cookies.has("soar_session");
  if (isProtected && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  const res = NextResponse.next();
  res.headers.set("x-pathname", pathname);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|api/cron|api/webhooks|api/health).*)"],
};
