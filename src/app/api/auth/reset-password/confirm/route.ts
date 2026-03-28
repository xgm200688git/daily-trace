import { NextResponse } from "next/server";
import { z } from "zod";
import { resetPassword } from "@/features/auth/service";
import { isAuthEnabled } from "@/lib/auth";

const ResetPasswordConfirmSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(8),
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
    const { token, newPassword } = ResetPasswordConfirmSchema.parse(body);

    const success = await resetPassword(token, newPassword);

    if (!success) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 400 },
      );
    }

    return NextResponse.json({
      message: "Password has been reset successfully",
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
