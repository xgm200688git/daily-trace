import { NextResponse } from "next/server";

import { listTemplates, saveTemplateFromRawJson } from "@/features/templates/service";

export const dynamic = 'force-dynamic';

export async function GET() {
  const templates = await listTemplates();

  return NextResponse.json({
    ok: true,
    templates,
  });
}

export async function POST(request: Request) {
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
