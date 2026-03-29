import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { updateUserPassword, verifyPassword, getUserById } from "@/features/auth/user-service";
import { getSession, getSessionCookieName } from "@/lib/session";

export const dynamic = 'force-dynamic';

const ChangePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8),
});

export async function POST(request: NextRequest) {
  try {
    const cookieName = getSessionCookieName();
    const sessionId = request.cookies.get(cookieName)?.value;

    if (!sessionId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = ChangePasswordSchema.parse(body);

    const user = await getUserById(session.userId);
    if (!user) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    const isValid = await verifyPassword(data.currentPassword, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ ok: false, error: "Current password is incorrect" }, { status: 400 });
    }

    await updateUserPassword(session.userId, data.newPassword);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
