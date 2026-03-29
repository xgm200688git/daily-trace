import { NextResponse, type NextRequest } from "next/server";
import { deleteSession, getSessionCookieName } from "@/lib/session";

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const cookieName = getSessionCookieName();
  const sessionId = request.cookies.get(cookieName)?.value;

  if (sessionId) {
    deleteSession(sessionId);
  }

  const response = NextResponse.json({ ok: true });

  response.cookies.set(cookieName, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });

  return response;
}
