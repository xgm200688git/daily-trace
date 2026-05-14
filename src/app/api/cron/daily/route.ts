import { NextResponse } from "next/server";

import { ensureCronAuthorized } from "@/lib/cron";
import { runDailyCron } from "@/features/reconcile/service";

export async function GET(request: Request) {
  const unauthorized = ensureCronAuthorized(request);

  if (unauthorized) {
    return unauthorized;
  }

  await runDailyCron();

  return NextResponse.json({
    ok: true,
    job: "daily",
  });
}
