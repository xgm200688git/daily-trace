import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken, isAuthEnabled } from "@/lib/auth";

export function middleware(request: NextRequest) {
  if (!isAuthEnabled()) {
    return NextResponse.next();
  }

  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  const pathname = request.nextUrl.pathname;

  if (
    pathname.startsWith("/api/auth/") ||
    pathname === "/" ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/public/")
  ) {
    return NextResponse.next();
  }

  if (!token) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  const payload = verifyToken(token);
  if (!payload) {
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 401 },
    );
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", payload.userId.toString());
  requestHeaders.set("x-user-email", payload.email);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    "/api/:path*",
  ],
};
