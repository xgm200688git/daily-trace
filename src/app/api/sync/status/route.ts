import { NextResponse } from "next/server";
import { getSession, getSessionCookieName } from "@/lib/session";
import { getCloudSyncManager } from "@/lib/cloud-sync";
import { getCurrentUserDbClient } from "@/lib/auth";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
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
    const syncState = syncManager.getState();
    
    let lastSyncAt = syncState.lastSyncAt;
    
    try {
      const result = await client.get<{ last_sync_at: string | null }>(
        `SELECT last_sync_at FROM sync_status ORDER BY id DESC LIMIT 1`
      );
      if (result) {
        lastSyncAt = result.last_sync_at;
      }
    } catch {
    }

    let pendingChangesCount = syncState.pendingChangesCount;
    
    try {
      const pendingResult = await client.get<{ count: number }>(
        `SELECT COUNT(*) as count FROM change_queue WHERE status IN ('pending', 'failed')`
      );
      if (pendingResult) {
        pendingChangesCount = pendingResult.count;
      }
    } catch {
    }

    return NextResponse.json({
      status: syncState.status,
      lastSyncAt,
      lastError: syncState.lastError,
      pendingChangesCount,
      progress: 0,
    });
  } catch (error) {
    return NextResponse.json({
      status: "error",
      lastSyncAt: null,
      lastError: error instanceof Error ? error.message : "Failed to get sync status",
      pendingChangesCount: 0,
      progress: 0,
    });
  }
}
