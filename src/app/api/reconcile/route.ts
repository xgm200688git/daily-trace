import { NextResponse } from "next/server";

import { ensureCronAuthorized } from "@/lib/cron";
import { reconcileOnAppOpen } from "@/features/reconcile/service";

export async function POST(request: Request) {
  const unauthorized = ensureCronAuthorized(request);

  if (unauthorized) {
    return unauthorized;
  }

  await reconcileOnAppOpen();

  return NextResponse.json({
    ok: true,
    job: "reconcile",
  });
}
