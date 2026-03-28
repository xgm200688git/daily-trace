import { NextResponse } from "next/server";
import { z } from "zod";
import { loginUser } from "@/features/auth/service";
import { isAuthEnabled } from "@/lib/auth";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
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
    const { email, password } = LoginSchema.parse(body);

    const result = await loginUser(email, password);

    if (!result) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 },
      );
    }

    return NextResponse.json({
      user: {
        id: result.user.id,
        email: result.user.email,
        createdAt: result.user.createdAt,
      },
      token: result.token,
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
