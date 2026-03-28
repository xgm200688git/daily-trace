import { NextResponse } from "next/server";

import { DEFAULT_CRON_SECRET_HEADER } from "@/lib/constants";

export function ensureCronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return null;
  }

  const url = new URL(request.url);
  const candidate =
    request.headers.get(DEFAULT_CRON_SECRET_HEADER) ??
    url.searchParams.get("secret");

  if (candidate === secret) {
    return null;
  }

  return NextResponse.json(
    {
      ok: false,
      error: "未授权的定时任务调用。",
    },
    { status: 401 },
  );
}
