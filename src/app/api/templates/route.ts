import { NextResponse } from "next/server";
import { getSession, getSessionCookieName } from "@/lib/session";
import { getCurrentUserDbClient } from "@/lib/auth";

import { listTemplates, saveTemplateFromRawJson } from "@/features/templates/service";

export const dynamic = 'force-dynamic';

async function authenticateRequest(request: Request) {
  const cookieName = getSessionCookieName();
  const cookies = request.headers.get("cookie") || "";
  const sessionIdMatch = cookies.match(new RegExp(`${cookieName}=([^;]+)`));
  const sessionId = sessionIdMatch ? sessionIdMatch[1] : null;

  if (!sessionId) {
    return null;
  }

  const session = getSession(sessionId);
  if (!session) {
    return null;
  }

  const client = await getCurrentUserDbClient();
  if (!client) {
    return null;
  }

  return session;
}

export async function GET(request: Request) {
  const session = await authenticateRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const templates = await listTemplates();

  return NextResponse.json({
    ok: true,
    templates,
  });
}

export async function POST(request: Request) {
  const session = await authenticateRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    definition: unknown;
    name?: string;
    templateId?: string;
  };

  const template = await saveTemplateFromRawJson(
    JSON.stringify(body.definition),
    body.name,
    body.templateId,
  );

  return NextResponse.json({
    ok: true,
    template,
  });
}
