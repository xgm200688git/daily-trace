import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE_NAME = "dt_session_id";
const PUBLIC_PATHS = ["/login", "/register", "/api/auth"];

export function middleware(request: NextRequest) {
  const sessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const isPublicPath = PUBLIC_PATHS.some(
    (path) => request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(path + "/"),
  );

  const response = NextResponse.next();

  if (sessionId) {
    response.headers.set("x-session-id", sessionId);
  }

  if (isPublicPath && sessionId) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!isPublicPath && !sessionId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
};
