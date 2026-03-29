import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getUserByEmail, verifyPassword } from "@/features/auth/user-service";
import { createSession, getSessionCookieName, getSessionExpiresDays } from "@/lib/session";

export const dynamic = 'force-dynamic';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = LoginSchema.parse(body);

    const user = getUserByEmail(data.email);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
    }

    const isValid = await verifyPassword(data.password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
    }

    const session = createSession(user.id);

    const response = NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
      },
    });

    const cookieName = getSessionCookieName();
    const expires = new Date(Date.now() + getSessionExpiresDays() * 24 * 60 * 60 * 1000);

    response.cookies.set(cookieName, session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires,
    });

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
