"use client";

import { useState, useEffect, useCallback } from "react";
import { formatLocalTime } from "@/lib/time";

type SyncStatusState = "idle" | "syncing" | "success" | "error" | "degraded";

interface SyncState {
  status: SyncStatusState;
  lastSyncAt: string | null;
  lastError: string | null;
  pendingChangesCount: number;
  progress: number;
}

async function fetchSyncState(): Promise<SyncState> {
  try {
    const response = await fetch("/api/sync/status");
    if (!response.ok) {
      throw new Error("Failed to fetch sync status");
    }
    return await response.json();
  } catch {
    return {
      status: "idle",
      lastSyncAt: null,
      lastError: null,
      pendingChangesCount: 0,
      progress: 0,
    };
  }
}

async function triggerSync(): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch("/api/sync/trigger", { method: "POST" });
    if (!response.ok) {
      throw new Error("Failed to trigger sync");
    }
    return await response.json();
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Sync failed" };
  }
}

export function SyncStatus() {
  const [syncState, setSyncState] = useState<SyncState>({
    status: "idle",
    lastSyncAt: null,
    lastError: null,
    pendingChangesCount: 0,
    progress: 0,
  });
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  const loadSyncState = useCallback(async () => {
    const state = await fetchSyncState();
    setSyncState(state);
  }, []);

  useEffect(() => {
    setTimeout(loadSyncState, 0);
    
    const interval = setInterval(loadSyncState, 10000);
    return () => clearInterval(interval);
  }, [loadSyncState]);

  const handleManualSync = async () => {
    if (syncState.status === "syncing" || isManualSyncing) return;
    
    setIsManualSyncing(true);
    setSyncState(prev => ({ ...prev, status: "syncing", progress: 0 }));
    
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress = Math.min(progress + Math.random() * 30, 90);
      setSyncState(prev => ({ ...prev, progress }));
    }, 500);

    const result = await triggerSync();
    
    clearInterval(progressInterval);
    
    if (result.success) {
      setSyncState(prev => ({
        ...prev,
        status: "success",
        progress: 100,
        lastError: null,
      }));
      await loadSyncState();
    } else {
      setSyncState(prev => ({
        ...prev,
        status: "error",
        progress: 0,
        lastError: result.error || "同步失败",
      }));
    }
    
    setIsManualSyncing(false);
  };

  const getStatusText = () => {
    switch (syncState.status) {
      case "syncing":
        return "同步中...";
      case "success":
        return "已同步";
      case "error":
        return "同步失败";
      case "degraded":
        return "离线模式";
      default:
        return "准备同步";
    }
  };

  const getStatusColor = () => {
    switch (syncState.status) {
      case "syncing":
        return "text-amber-600 bg-amber-50 border-amber-200";
      case "success":
        return "text-emerald-600 bg-emerald-50 border-emerald-200";
      case "error":
        return "text-rose-600 bg-rose-50 border-rose-200";
      case "degraded":
        return "text-stone-600 bg-stone-50 border-stone-200";
      default:
        return "text-stone-600 bg-stone-50 border-stone-200";
    }
  };

  const getStatusIndicator = () => {
    switch (syncState.status) {
      case "syncing":
        return (
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            <span>{getStatusText()}</span>
          </div>
        );
      case "success":
        return (
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>{getStatusText()}</span>
          </div>
        );
      case "error":
        return (
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-rose-500" />
            <span>{getStatusText()}</span>
          </div>
        );
      case "degraded":
        return (
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-stone-400" />
            <span>{getStatusText()}</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-stone-400" />
            <span>{getStatusText()}</span>
          </div>
        );
    }
  };

  return (
    <div className="rounded-[2rem] border border-black/6 bg-white/86 px-6 py-6 shadow-[0_18px_60px_rgba(31,20,10,0.05)]">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-sm font-medium text-stone-400">云端同步</p>
          <h3 className="text-xl font-semibold text-stone-950">同步状态</h3>
        </div>
        <button
          type="button"
          onClick={handleManualSync}
          disabled={syncState.status === "syncing" || isManualSyncing}
          className={`inline-flex items-center gap-2 rounded-full border border-black/8 px-4 py-2 text-sm font-medium transition ${
            syncState.status === "syncing" || isManualSyncing
              ? "cursor-not-allowed opacity-50"
              : "hover:border-black/20 hover:text-black"
          }`}
        >
          {syncState.status === "syncing" || isManualSyncing ? (
            <>
              <div className="h-3 w-3 rounded-full border-2 border-stone-400 border-t-transparent animate-spin" />
              同步中...
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              手动同步
            </>
          )}
        </button>
      </div>

      <div className={`rounded-[1.6rem] border px-4 py-3 text-sm ${getStatusColor()}`}>
        {getStatusIndicator()}
      </div>

      {(syncState.status === "syncing" || isManualSyncing) && (
        <div className="mt-4">
          <div className="h-2 w-full bg-stone-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all duration-300"
              style={{ width: `${syncState.progress}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-stone-500">
            {syncState.progress > 0 ? Math.round(syncState.progress) : 0}%
          </p>
        </div>
      )}

      <div className="mt-4 space-y-2 text-sm">
        {syncState.lastSyncAt && (
          <div className="flex items-center justify-between text-stone-600">
            <span>最后同步</span>
            <span className="font-mono text-xs">
              {formatLocalTime(new Date(syncState.lastSyncAt))}
            </span>
          </div>
        )}
        {syncState.pendingChangesCount > 0 && (
          <div className="flex items-center justify-between text-stone-600">
            <span>待同步变更</span>
            <span className="font-medium">{syncState.pendingChangesCount} 项</span>
          </div>
        )}
        {syncState.lastError && (
          <div className="rounded-[1.6rem] border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
            {syncState.lastError}
          </div>
        )}
      </div>
    </div>
  );
}
