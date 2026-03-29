import { NextResponse } from "next/server";

import { ensureCronAuthorized } from "@/lib/cron";
import { runWeeklyCron } from "@/features/reconcile/service";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const unauthorized = ensureCronAuthorized(request);

  if (unauthorized) {
    return unauthorized;
  }

  await runWeeklyCron();

  return NextResponse.json({
    ok: true,
    job: "weekly",
  });
}
