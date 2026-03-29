import { NextResponse, type NextRequest } from "next/server";
import { getUserById } from "@/features/auth/user-service";
import { getSession, getSessionCookieName } from "@/lib/session";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const cookieName = getSessionCookieName();
  const sessionId = request.cookies.get(cookieName)?.value;

  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const user = getUserById(session.userId);
  if (!user) {
    return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
    },
  });
}
