import { NextResponse } from "next/server";
import { z } from "zod";
import { createPasswordResetToken } from "@/features/auth/service";
import { isAuthEnabled } from "@/lib/auth";

const ResetPasswordRequestSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  if (!isAuthEnabled()) {
    return NextResponse.json(
      { error: "Authentication is not enabled" },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const { email } = ResetPasswordRequestSchema.parse(body);

    const token = await createPasswordResetToken(email);

    if (!token) {
      return NextResponse.json({
        message: "If the email exists, a password reset link has been sent",
      });
    }

    return NextResponse.json({
      message: "If the email exists, a password reset link has been sent",
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
