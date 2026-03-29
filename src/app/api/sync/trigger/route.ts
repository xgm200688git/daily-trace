import { NextResponse } from "next/server";
import { getSession, getSessionCookieName } from "@/lib/session";
import { getCloudSyncManager } from "@/lib/cloud-sync";
import { getCurrentUserDbClient } from "@/lib/auth";

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const cookieName = getSessionCookieName();
  const cookies = request.headers.get("cookie") || "";
  const sessionIdMatch = cookies.match(new RegExp(`${cookieName}=([^;]+)`));
  const sessionId = sessionIdMatch ? sessionIdMatch[1] : null;

  if (!sessionId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await getCurrentUserDbClient();
  if (!client) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const syncManager = getCloudSyncManager();
    await syncManager.setupNetworkMonitoring();
    const stats = await syncManager.incrementalSync();
    
    if (stats.errors.length > 0 || stats.failedCount > 0) {
      return NextResponse.json({
        success: false,
        error: stats.errors.length > 0 ? stats.errors[0] : `Failed to sync ${stats.failedCount} changes`,
        stats: {
          uploadCount: stats.uploadCount,
          downloadCount: stats.downloadCount,
          failedCount: stats.failedCount,
          duration: stats.duration,
        },
      });
    }

    return NextResponse.json({
      success: true,
      stats: {
        uploadCount: stats.uploadCount,
        downloadCount: stats.downloadCount,
        failedCount: stats.failedCount,
        duration: stats.duration,
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to trigger sync",
    });
  }
}
