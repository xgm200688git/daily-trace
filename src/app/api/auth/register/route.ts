import { NextResponse } from "next/server";
import { z } from "zod";
import { registerUser } from "@/features/auth/service";
import { isAuthEnabled } from "@/lib/auth";

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
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
    const { email, password } = RegisterSchema.parse(body);

    const result = await registerUser(email, password);

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

    if (error instanceof Error && error.message === "Email already registered") {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
