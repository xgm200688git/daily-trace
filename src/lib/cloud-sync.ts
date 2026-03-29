import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { DatabaseClient, db, nowIso } from './db';
import { hashValue } from './hash';

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'degraded';

export type DatabaseStrategy = 'sqlite' | 'supabase';

export type NetworkStatus = 'online' | 'offline' | 'unknown';

export type SSEConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface DatabaseAdapter {
  strategy: DatabaseStrategy;
  isConnected: () => Promise<boolean>;
  get: <T>(sql: string, params?: unknown[]) => Promise<T | undefined>;
  all: <T>(sql: string, params?: unknown[]) => Promise<T[]>;
  run: (sql: string, params?: unknown[]) => Promise<{ changes: number; lastInsertRowid?: number | string | bigint }>;
  transaction: <T>(fn: () => Promise<T>) => Promise<T>;
  close: () => Promise<void>;
}

export interface SyncConfig {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  enabled: boolean;
  autoSync: boolean;
  fallbackToLocal: boolean;
  maxRetries: number;
  initialRetryDelay: number;
  networkCheckInterval: number;
}

export interface MigrationStats {
  tablesMigrated: string[];
  recordsMigrated: number;
  errors: string[];
  duration: number;
}

export interface SyncState {
  currentStrategy: DatabaseStrategy;
  status: SyncStatus;
  lastSyncAt: string | null;
  lastError: string | null;
  networkStatus: NetworkStatus;
  pendingChangesCount: number;
  sseStatus: SSEConnectionStatus;
  sseLastConnectedAt: string | null;
}

export interface SSEEventData {
  [key: string]: unknown;
}

export interface SSEEvent {
  type: string;
  data: SSEEventData;
}

export interface SSEChangeEvent {
  type: 'change';
  data: {
    tableName: string;
    recordId: string;
    operation: ChangeOperation;
    timestamp: string;
  };
}

export interface SSEConnectedEvent {
  type: 'connected';
  data: {
    connectionId: string;
    userId: number;
    timestamp: string;
  };
}

export type ChangeOperation = 'insert' | 'update' | 'delete';

export type ChangeQueueStatus = 'pending' | 'processing' | 'synced' | 'failed';

export interface ChangeQueueItem {
  id: number;
  table_name: string;
  record_id: string;
  operation: ChangeOperation;
  change_data: string | null;
  status: ChangeQueueStatus;
  source_hash: string;
  retry_count: number;
  last_retry_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyncableTable {
  name: string;
  primaryKey: string;
  hasSourceHash?: boolean;
}

export interface IncrementalSyncStats {
  uploadCount: number;
  downloadCount: number;
  failedCount: number;
  duration: number;
  errors: string[];
  conflictCount: number;
  resolvedCount: number;
}

export type ConflictType = 'timestamp_conflict' | 'hash_conflict' | 'dual_update_conflict';

export type ResolutionStrategy = 'last_write_wins' | 'user_manual' | 'local_wins' | 'cloud_wins';

export type WinnerSource = 'local' | 'cloud';

export interface ConflictRecord {
  id: number;
  tableName: string;
  recordId: string;
  conflictType: ConflictType;
  localUpdatedAt: string | null;
  cloudUpdatedAt: string | null;
  localSourceHash: string | null;
  cloudSourceHash: string | null;
  resolvedStrategy: ResolutionStrategy;
  winnerSource: WinnerSource;
  localData: string | null;
  cloudData: string | null;
  createdAt: string;
}

export interface ConflictDetectionResult {
  hasConflict: boolean;
  conflictType?: ConflictType;
  localRecord?: Record<string, unknown>;
  cloudRecord?: Record<string, unknown>;
}

const DEFAULT_CONFIG: SyncConfig = {
  enabled: process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? true : false,
  autoSync: true,
  fallbackToLocal: true,
  maxRetries: 5,
  initialRetryDelay: 1000,
  networkCheckInterval: 30000,
};

const SYNCABLE_TABLES: SyncableTable[] = [
  { name: 'profile_settings', primaryKey: 'id' },
  { name: 'templates', primaryKey: 'id' },
  { name: 'entries', primaryKey: 'id' },
  { name: 'daily_records', primaryKey: 'id', hasSourceHash: true },
  { name: 'weekly_reports', primaryKey: 'id', hasSourceHash: true },
  { name: 'job_runs', primaryKey: 'id' },
];

class SQLiteAdapter implements DatabaseAdapter {
  strategy: DatabaseStrategy = 'sqlite';
  private dbClient: DatabaseClient;

  constructor(dbClient: DatabaseClient) {
    this.dbClient = dbClient;
  }

  async isConnected(): Promise<boolean> {
    try {
      this.dbClient.get('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async get<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    return this.dbClient.get<T>(sql, params as Array<string | number | null>);
  }

  async all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.dbClient.all<T>(sql, params as Array<string | number | null>);
  }

  async run(sql: string, params: unknown[] = []): Promise<{ changes: number; lastInsertRowid?: number | string | bigint }> {
    const result = this.dbClient.run(sql, params as Array<string | number | null>);
    return {
      changes: result.changes,
      lastInsertRowid: result.lastInsertRowid,
    };
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    return this.dbClient.transaction(() => fn());
  }

  async close(): Promise<void> {
  }
}

class SupabaseAdapter implements DatabaseAdapter {
  strategy: DatabaseStrategy = 'supabase';
  private client: SupabaseClient | null = null;
  private url: string;
  private anonKey: string;

  constructor(url: string, anonKey: string) {
    this.url = url;
    this.anonKey = anonKey;
    this.client = createClient(url, anonKey);
  }

  async isConnected(): Promise<boolean> {
    if (!this.client) return false;
    try {
      const { error } = await this.client.from('profile_settings').select('count', { count: 'exact', head: true });
      return !error;
    } catch {
      return false;
    }
  }

  private async executeSql<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (!this.client) throw new Error('Supabase client not initialized');
    const { data, error } = await this.client.rpc('execute_sql', { sql_query: sql, params: params });
    if (error) throw error;
    return data as T[];
  }

  async get<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    const results = await this.executeSql<T>(sql, params);
    return results[0];
  }

  async all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return await this.executeSql<T>(sql, params);
  }

  async run(sql: string, params: unknown[] = []): Promise<{ changes: number; lastInsertRowid?: number | string | bigint }> {
    const results = await this.executeSql<{ changes: number; last_insert_rowid?: number | string | bigint }>(sql, params);
    return {
      changes: results[0]?.changes || 0,
      lastInsertRowid: results[0]?.last_insert_rowid,
    };
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    return await fn();
  }

  async close(): Promise<void> {
    this.client = null;
  }

  getClient(): SupabaseClient | null {
    return this.client;
  }
}

export class CloudSyncManager {
  private config: SyncConfig;
  private currentAdapter: DatabaseAdapter;
  private sqliteAdapter: SQLiteAdapter;
  private supabaseAdapter: SupabaseAdapter | null = null;
  private state: SyncState;
  private networkCheckInterval: NodeJS.Timeout | null = null;
  private isListeningForNetwork: boolean = false;
  private syncInProgress: boolean = false;

  private sseEventSource: EventSource | null = null;
  private sseReconnectTimeout: NodeJS.Timeout | null = null;
  private sseReconnectAttempts: number = 0;
  private sseMaxReconnectAttempts: number = 10;
  private sseInitialReconnectDelay: number = 1000;
  private sseEventListeners: Map<string, ((event: SSEEvent) => void)[]> = new Map();

  constructor(config?: Partial<SyncConfig>, dbClient?: DatabaseClient) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sqliteAdapter = new SQLiteAdapter(dbClient || db);
    this.currentAdapter = this.sqliteAdapter;
    this.state = {
      currentStrategy: 'sqlite',
      status: 'idle',
      lastSyncAt: null,
      lastError: null,
      networkStatus: 'unknown',
      pendingChangesCount: 0,
      sseStatus: 'disconnected',
      sseLastConnectedAt: null,
    };

    if (this.config.enabled) {
      this.initializeSupabase();
    }
  }

  private initializeSupabase(): void {
    const url = this.config.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = this.config.supabaseAnonKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (url && anonKey) {
      this.supabaseAdapter = new SupabaseAdapter(url, anonKey);
    }
  }

  private isClientSide(): boolean {
    return typeof window !== 'undefined';
  }

  async checkNetworkStatus(): Promise<NetworkStatus> {
    try {
      if (this.isClientSide() && 'navigator' in window) {
        if (!navigator.onLine) {
          this.state.networkStatus = 'offline';
          return 'offline';
        }
      }

      if (!this.config.enabled || !this.supabaseAdapter) {
        this.state.networkStatus = 'unknown';
        return 'unknown';
      }

      const isConnected = await this.supabaseAdapter.isConnected();
      const newStatus: NetworkStatus = isConnected ? 'online' : 'offline';
      
      if (this.state.networkStatus === 'offline' && newStatus === 'online') {
        await this.onNetworkRestored();
      }
      
      this.state.networkStatus = newStatus;
      return newStatus;
    } catch {
      this.state.networkStatus = 'offline';
      return 'offline';
    }
  }

  async setupNetworkMonitoring(): Promise<void> {
    if (this.isListeningForNetwork) {
      return;
    }

    this.isListeningForNetwork = true;

    if (this.isClientSide() && 'navigator' in window) {
      window.addEventListener('online', () => this.onNetworkRestored());
      window.addEventListener('offline', () => this.onNetworkLost());
    }

    this.networkCheckInterval = setInterval(() => {
      this.checkNetworkStatus();
    }, this.config.networkCheckInterval);

    await this.checkNetworkStatus();
    await this.updatePendingChangesCount();

    if (this.isClientSide() && this.config.enabled && this.state.networkStatus === 'online') {
      await this.connectSSE();
    }
  }

  async stopNetworkMonitoring(): Promise<void> {
    if (this.networkCheckInterval) {
      clearInterval(this.networkCheckInterval);
      this.networkCheckInterval = null;
    }
    this.isListeningForNetwork = false;
  }

  private async onNetworkRestored(): Promise<void> {
    this.state.networkStatus = 'online';
    this.state.status = 'idle';
    
    if (this.config.autoSync) {
      await this.incrementalSync();
    }

    if (this.config.enabled) {
      await this.connectSSE();
    }
  }

  private broadcastLocalChange(
    tableName: string,
    recordId: string,
    operation: ChangeOperation
  ): void {
    const event = {
      type: 'change',
      data: {
        tableName,
        recordId,
        operation,
        timestamp: nowIso(),
      },
    } as SSEEvent;
    this.handleSSEEvent(event);
  }

  private async onNetworkLost(): Promise<void> {
    this.state.networkStatus = 'offline';
    this.state.currentStrategy = 'sqlite';
    this.currentAdapter = this.sqliteAdapter;
    this.state.status = 'degraded';
  }

  async connect(): Promise<boolean> {
    if (!this.config.enabled || !this.supabaseAdapter) {
      this.state.currentStrategy = 'sqlite';
      this.currentAdapter = this.sqliteAdapter;
      return true;
    }

    const networkStatus = await this.checkNetworkStatus();

    if (networkStatus === 'online') {
      try {
        const isConnected = await this.supabaseAdapter.isConnected();
        if (isConnected) {
          this.state.currentStrategy = 'supabase';
          this.currentAdapter = this.supabaseAdapter;
          this.state.status = 'success';
          return true;
        }
      } catch (error) {
        this.state.lastError = error instanceof Error ? error.message : 'Unknown connection error';
        this.state.status = 'error';
      }
    }

    this.state.currentStrategy = 'sqlite';
    this.currentAdapter = this.sqliteAdapter;
    this.state.status = 'degraded';
    return true;
  }

  getAdapter(): DatabaseAdapter {
    return this.currentAdapter;
  }

  getLocalAdapter(): DatabaseAdapter {
    return this.sqliteAdapter;
  }

  getState(): SyncState {
    return { ...this.state };
  }

  async migrateLocalToCloud(): Promise<MigrationStats> {
    const startTime = Date.now();
    const stats: MigrationStats = {
      tablesMigrated: [],
      recordsMigrated: 0,
      errors: [],
      duration: 0,
    };

    if (!this.supabaseAdapter) {
      stats.errors.push('Supabase adapter not initialized');
      stats.duration = Date.now() - startTime;
      return stats;
    }

    const tables = [
      'profile_settings',
      'templates',
      'entries',
      'daily_records',
      'weekly_reports',
      'job_runs',
    ];

    for (const table of tables) {
      try {
        const records = await this.sqliteAdapter.all<Record<string, unknown>>(`SELECT * FROM ${table} WHERE deleted_at IS NULL`);
        if (records.length > 0) {
          for (const record of records) {
            await this.supabaseAdapter.run(
              this.buildInsertQuery(table, record),
              Object.values(record) as unknown[]
            );
            stats.recordsMigrated++;
          }
          stats.tablesMigrated.push(table);
        }
      } catch (error) {
        stats.errors.push(`Failed to migrate ${table}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    stats.duration = Date.now() - startTime;
    this.state.lastSyncAt = nowIso();
    this.state.status = stats.errors.length === 0 ? 'success' : 'error';

    return stats;
  }

  private buildInsertQuery(table: string, record: Record<string, unknown>): string {
    const columns = Object.keys(record).join(', ');
    const placeholders = Object.keys(record).map((_, i) => `$${i + 1}`).join(', ');
    return `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
  }

  async setConfig(config: Partial<SyncConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    if (config.enabled !== undefined && config.enabled) {
      this.initializeSupabase();
      await this.connect();
    }
  }

  private async updatePendingChangesCount(): Promise<void> {
    try {
      const result = await this.sqliteAdapter.get<{ count: number }>(
        `SELECT COUNT(*) as count FROM change_queue WHERE status IN ('pending', 'failed')`
      );
      this.state.pendingChangesCount = result?.count || 0;
    } catch {
      this.state.pendingChangesCount = 0;
    }
  }

  async enqueueChange(
    tableName: string,
    recordId: string,
    operation: ChangeOperation,
    changeData?: Record<string, unknown>
  ): Promise<void> {
    const sourceHash = hashValue({ tableName, recordId, operation, changeData, timestamp: nowIso() });
    const now = nowIso();

    await this.sqliteAdapter.run(
      `INSERT INTO change_queue (table_name, record_id, operation, change_data, status, source_hash, retry_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [
        tableName,
        recordId,
        operation,
        changeData ? JSON.stringify(changeData) : null,
        'pending',
        sourceHash,
        now,
        now
      ]
    );

    await this.updatePendingChangesCount();

    if (this.state.networkStatus === 'online' && this.config.autoSync && !this.syncInProgress) {
      await this.incrementalSync();
    }
  }

  async getPendingChanges(): Promise<ChangeQueueItem[]> {
    return await this.sqliteAdapter.all<ChangeQueueItem>(
      `SELECT * FROM change_queue 
       WHERE status IN ('pending', 'failed') 
       ORDER BY created_at ASC`
    );
  }

  async markChangeStatus(
    changeId: number,
    status: ChangeQueueStatus,
    errorMessage?: string
  ): Promise<void> {
    const now = nowIso();
    const params: Array<string | number | null> = [status, now];

    let sql = `UPDATE change_queue SET status = ?, updated_at = ?`;
    
    if (errorMessage) {
      sql += `, error_message = ?, last_retry_at = ?, retry_count = retry_count + 1`;
      params.push(errorMessage, now);
    }
    
    sql += ` WHERE id = ?`;
    params.push(changeId);

    await this.sqliteAdapter.run(sql, params);
    await this.updatePendingChangesCount();
  }

  async clearSyncedChanges(): Promise<void> {
    await this.sqliteAdapter.run(`DELETE FROM change_queue WHERE status = 'synced'`);
    await this.updatePendingChangesCount();
  }

  async retryFailedChanges(): Promise<number> {
    const failedChanges = await this.sqliteAdapter.all<ChangeQueueItem>(
      `SELECT * FROM change_queue 
       WHERE status = 'failed' 
         AND retry_count < ?
       ORDER BY created_at ASC`,
      [this.config.maxRetries]
    );

    let retryCount = 0;
    for (const change of failedChanges) {
      await this.markChangeStatus(change.id, 'pending');
      retryCount++;
    }

    return retryCount;
  }

  private async getLastSyncTimestamp(): Promise<string | null> {
    const result = await this.sqliteAdapter.get<{ last_sync_at: string | null }>(
      `SELECT last_sync_at FROM sync_status ORDER BY id DESC LIMIT 1`
    );
    return result?.last_sync_at ?? null;
  }

  private async updateLastSyncTimestamp(timestamp: string): Promise<void> {
    const now = nowIso();
    const exists = await this.sqliteAdapter.get<{ id: number }>(
      `SELECT id FROM sync_status LIMIT 1`
    );

    if (exists) {
      await this.sqliteAdapter.run(
        `UPDATE sync_status SET last_sync_at = ?, sync_status = 'success', updated_at = ? WHERE id = ?`,
        [timestamp, now, exists.id]
      );
    } else {
      await this.sqliteAdapter.run(
        `INSERT INTO sync_status (last_sync_at, sync_status, created_at, updated_at) VALUES (?, 'success', ?, ?)`,
        [timestamp, now, now]
      );
    }
  }

  async detectLocalChanges(since: string | null): Promise<{ tableName: string; records: Record<string, unknown>[] }[]> {
    const changes: { tableName: string; records: Record<string, unknown>[] }[] = [];

    for (const table of SYNCABLE_TABLES) {
      let sql = `SELECT * FROM ${table.name}`;
      const params: Array<string | number | null> = [];

      if (since) {
        sql += ` WHERE updated_at > ? AND deleted_at IS NULL`;
        params.push(since);
      } else {
        sql += ` WHERE deleted_at IS NULL`;
      }

      const records = await this.sqliteAdapter.all<Record<string, unknown>>(sql, params);
      if (records.length > 0) {
        changes.push({ tableName: table.name, records });
      }
    }

    return changes;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = this.config.maxRetries,
    initialDelay: number = this.config.initialRetryDelay
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt === maxRetries) {
          break;
        }

        const delayMs = initialDelay * Math.pow(2, attempt);
        await this.delay(delayMs);
      }
    }

    throw lastError;
  }

  private async uploadRecord(tableName: string, record: Record<string, unknown>, sourceHash: string): Promise<void> {
    if (!this.supabaseAdapter) {
      throw new Error('Supabase adapter not initialized');
    }

    const table = SYNCABLE_TABLES.find(t => t.name === tableName);
    if (!table) {
      throw new Error(`Table ${tableName} is not syncable`);
    }

    const existing = await this.supabaseAdapter.get<Record<string, unknown>>(
      `SELECT source_hash FROM ${tableName} WHERE ${table.primaryKey} = ?`,
      [record[table.primaryKey] as string | number | null]
    );

    if (existing && existing.source_hash === sourceHash) {
      return;
    }

    const columns = Object.keys(record);
    const placeholders = columns.map((_, i) => `$${i + 1}`);
    const values = Object.values(record);

    const updateClause = columns
      .filter(col => col !== table.primaryKey)
      .map(col => `${col} = EXCLUDED.${col}`)
      .join(', ');

    await this.supabaseAdapter.run(
      `INSERT INTO ${tableName} (${columns.join(', ')}) 
       VALUES (${placeholders.join(', ')}) 
       ON CONFLICT (${table.primaryKey}) 
       DO UPDATE SET ${updateClause}`,
      values as unknown[]
    );
  }

  private async uploadChanges(): Promise<number> {
    const changes = await this.getPendingChanges();
    let uploadCount = 0;

    for (const change of changes) {
      try {
        await this.markChangeStatus(change.id, 'processing');

        const table = SYNCABLE_TABLES.find(t => t.name === change.table_name);
        if (!table) {
          throw new Error(`Table ${change.table_name} is not syncable`);
        }

        if (change.operation === 'delete') {
          if (!this.supabaseAdapter) {
            throw new Error('Supabase adapter not initialized');
          }
          await this.supabaseAdapter.run(
            `UPDATE ${change.table_name} SET deleted_at = ? WHERE ${table.primaryKey} = ?`,
            [nowIso(), change.record_id]
          );
        } else {
          const record = change.change_data ? JSON.parse(change.change_data) : null;
          if (record) {
            await this.uploadRecord(change.table_name, record, change.source_hash);
          }
        }

        await this.markChangeStatus(change.id, 'synced');
        uploadCount++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await this.markChangeStatus(change.id, 'failed', errorMessage);
      }
    }

    return uploadCount;
  }

  private async detectConflict(
    table: SyncableTable,
    localRecord: Record<string, unknown> | null,
    cloudRecord: Record<string, unknown>
  ): Promise<ConflictDetectionResult> {
    if (!localRecord) {
      return { hasConflict: false };
    }

    const localUpdatedAt = new Date(localRecord.updated_at as string);
    const cloudUpdatedAt = new Date(cloudRecord.updated_at as string);
    const timeDifference = Math.abs(localUpdatedAt.getTime() - cloudUpdatedAt.getTime());
    const TIME_THRESHOLD_MS = 1000;

    if (table.hasSourceHash) {
      if (localRecord.source_hash !== cloudRecord.source_hash) {
        if (timeDifference < TIME_THRESHOLD_MS) {
          return {
            hasConflict: true,
            conflictType: 'dual_update_conflict',
            localRecord,
            cloudRecord
          };
        }
        return {
          hasConflict: true,
          conflictType: 'hash_conflict',
          localRecord,
          cloudRecord
        };
      }
    } else {
      if (timeDifference < TIME_THRESHOLD_MS) {
        return {
          hasConflict: true,
          conflictType: 'dual_update_conflict',
          localRecord,
          cloudRecord
        };
      }
      if (localUpdatedAt !== cloudUpdatedAt) {
        return {
          hasConflict: true,
          conflictType: 'timestamp_conflict',
          localRecord,
          cloudRecord
        };
      }
    }

    return { hasConflict: false };
  }

  private async resolveConflictLastWriteWins(
    table: SyncableTable,
    localRecord: Record<string, unknown> | null,
    cloudRecord: Record<string, unknown>
  ): Promise<{ winner: WinnerSource; winnerRecord: Record<string, unknown> }> {
    if (!localRecord) {
      return { winner: 'cloud', winnerRecord: cloudRecord };
    }

    const localUpdatedAt = new Date(localRecord.updated_at as string);
    const cloudUpdatedAt = new Date(cloudRecord.updated_at as string);

    if (cloudUpdatedAt > localUpdatedAt) {
      return { winner: 'cloud', winnerRecord: cloudRecord };
    } else {
      return { winner: 'local', winnerRecord: localRecord };
    }
  }

  private async recordConflict(
    tableName: string,
    recordId: string,
    conflictType: ConflictType,
    localRecord: Record<string, unknown> | null,
    cloudRecord: Record<string, unknown>,
    resolvedStrategy: ResolutionStrategy,
    winnerSource: WinnerSource
  ): Promise<void> {
    try {
      await this.sqliteAdapter.run(
        `INSERT INTO conflict_history 
         (table_name, record_id, conflict_type, local_updated_at, cloud_updated_at, 
          local_source_hash, cloud_source_hash, resolved_strategy, winner_source, 
          local_data, cloud_data, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tableName,
          recordId,
          conflictType,
          (localRecord?.updated_at as string | number | null) || null,
          cloudRecord.updated_at as string | number | null,
          (localRecord?.source_hash as string | number | null) || null,
          (cloudRecord.source_hash as string | number | null) || null,
          resolvedStrategy,
          winnerSource,
          localRecord ? JSON.stringify(localRecord) : null,
          JSON.stringify(cloudRecord),
          nowIso()
        ]
      );
    } catch (error) {
      console.error('Failed to record conflict:', error);
    }
  }

  private async applyWinnerRecord(
    table: SyncableTable,
    winnerSource: WinnerSource,
    winnerRecord: Record<string, unknown>
  ): Promise<void> {
    if (winnerSource === 'cloud') {
      const columns = Object.keys(winnerRecord);
      const placeholders = columns.map((_, i) => `$${i + 1}`);
      const values = Object.values(winnerRecord);

      const updateClause = columns
        .filter(col => col !== table.primaryKey)
        .map(col => `${col} = EXCLUDED.${col}`)
        .join(', ');

      await this.sqliteAdapter.run(
        `INSERT INTO ${table.name} (${columns.join(', ')}) 
         VALUES (${placeholders.join(', ')}) 
         ON CONFLICT (${table.primaryKey}) 
         DO UPDATE SET ${updateClause}`,
        values as unknown[]
      );
    } else if (this.supabaseAdapter) {
      await this.uploadRecord(table.name, winnerRecord, (winnerRecord.source_hash as string) || '');
    }
  }

  private async downloadChanges(since: string | null): Promise<{ downloadCount: number; conflictCount: number; resolvedCount: number }> {
    if (!this.supabaseAdapter) {
      throw new Error('Supabase adapter not initialized');
    }

    let downloadCount = 0;
    let conflictCount = 0;
    let resolvedCount = 0;

    for (const table of SYNCABLE_TABLES) {
      let sql = `SELECT * FROM ${table.name}`;
      const params: Array<string | number | null> = [];

      if (since) {
        sql += ` WHERE updated_at > ?`;
        params.push(since);
      }

      const cloudRecords = await this.supabaseAdapter.all<Record<string, unknown>>(sql, params);

      for (const cloudRecord of cloudRecords) {
        const localRecord = await this.sqliteAdapter.get<Record<string, unknown>>(
          `SELECT * FROM ${table.name} WHERE ${table.primaryKey} = ?`,
          [cloudRecord[table.primaryKey] as string | number | null]
        ) ?? null;

        const conflictResult = await this.detectConflict(table, localRecord, cloudRecord);

        if (conflictResult.hasConflict && conflictResult.conflictType) {
          conflictCount++;
          
          const { winner, winnerRecord } = await this.resolveConflictLastWriteWins(
            table,
            localRecord,
            cloudRecord
          );

          await this.recordConflict(
            table.name,
            cloudRecord[table.primaryKey] as string,
            conflictResult.conflictType,
            localRecord,
            cloudRecord,
            'last_write_wins',
            winner
          );

          await this.applyWinnerRecord(table, winner, winnerRecord);
          resolvedCount++;

          if (winner === 'cloud') {
            downloadCount++;
          }
        } else {
          let shouldSync = true;

          if (localRecord) {
            if (table.hasSourceHash && localRecord.source_hash === cloudRecord.source_hash) {
              shouldSync = false;
            } else if (new Date(localRecord.updated_at as string) >= new Date(cloudRecord.updated_at as string)) {
              shouldSync = false;
            }
          }

          if (shouldSync) {
            const columns = Object.keys(cloudRecord);
            const placeholders = columns.map((_, i) => `$${i + 1}`);
            const values = Object.values(cloudRecord);

            const updateClause = columns
              .filter(col => col !== table.primaryKey)
              .map(col => `${col} = EXCLUDED.${col}`)
              .join(', ');

            await this.sqliteAdapter.run(
              `INSERT INTO ${table.name} (${columns.join(', ')}) 
               VALUES (${placeholders.join(', ')}) 
               ON CONFLICT (${table.primaryKey}) 
               DO UPDATE SET ${updateClause}`,
              values as unknown[]
            );

            downloadCount++;
          }
        }
      }
    }

    return { downloadCount, conflictCount, resolvedCount };
  }

  async getConflictHistory(limit: number = 100): Promise<ConflictRecord[]> {
    const records = await this.sqliteAdapter.all<Record<string, unknown>>(
      `SELECT * FROM conflict_history ORDER BY created_at DESC LIMIT ?`,
      [limit]
    );
    
    return records.map(record => ({
      id: record.id as number,
      tableName: record.table_name as string,
      recordId: record.record_id as string,
      conflictType: record.conflict_type as ConflictType,
      localUpdatedAt: record.local_updated_at as string | null,
      cloudUpdatedAt: record.cloud_updated_at as string | null,
      localSourceHash: record.local_source_hash as string | null,
      cloudSourceHash: record.cloud_source_hash as string | null,
      resolvedStrategy: record.resolved_strategy as ResolutionStrategy,
      winnerSource: record.winner_source as WinnerSource,
      localData: record.local_data as string | null,
      cloudData: record.cloud_data as string | null,
      createdAt: record.created_at as string
    }));
  }

  async incrementalSync(): Promise<IncrementalSyncStats> {
    if (this.syncInProgress) {
      return {
        uploadCount: 0,
        downloadCount: 0,
        failedCount: 0,
        duration: 0,
        errors: ['Sync already in progress'],
        conflictCount: 0,
        resolvedCount: 0
      };
    }

    this.syncInProgress = true;
    const startTime = Date.now();
    const stats: IncrementalSyncStats = {
      uploadCount: 0,
      downloadCount: 0,
      failedCount: 0,
      duration: 0,
      errors: [],
      conflictCount: 0,
      resolvedCount: 0
    };

    try {
      const networkStatus = await this.checkNetworkStatus();
      
      if (networkStatus !== 'online') {
        stats.errors.push('Cannot sync: network is offline');
        stats.duration = Date.now() - startTime;
        this.syncInProgress = false;
        return stats;
      }

      if (!this.supabaseAdapter) {
        stats.errors.push('Supabase adapter not initialized');
        stats.duration = Date.now() - startTime;
        this.syncInProgress = false;
        return stats;
      }

      this.state.status = 'syncing';

      try {
        await this.retryWithBackoff(async () => {
          const isConnected = await this.supabaseAdapter!.isConnected();
          if (!isConnected) {
            throw new Error('Failed to connect to Supabase');
          }
        });

        const lastSyncAt = await this.getLastSyncTimestamp();

        await this.retryFailedChanges();

        stats.uploadCount = await this.uploadChanges();
        const downloadResult = await this.downloadChanges(lastSyncAt);
        stats.downloadCount = downloadResult.downloadCount;
        stats.conflictCount = downloadResult.conflictCount;
        stats.resolvedCount = downloadResult.resolvedCount;

        const pendingFailed = await this.sqliteAdapter.all<ChangeQueueItem>(
          `SELECT id FROM change_queue WHERE status = 'failed'`
        );
        stats.failedCount = pendingFailed.length;

        await this.updateLastSyncTimestamp(nowIso());
        await this.clearSyncedChanges();

        this.state.lastSyncAt = nowIso();
        this.state.status = stats.errors.length === 0 && stats.failedCount === 0 ? 'success' : 'error';
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown sync error';
        stats.errors.push(errorMessage);
        this.state.lastError = errorMessage;
        this.state.status = 'error';
      }
    } finally {
      this.syncInProgress = false;
    }

    stats.duration = Date.now() - startTime;
    return stats;
  }

  async connectSSE(): Promise<void> {
    if (!this.isClientSide()) {
      return;
    }

    if (this.state.sseStatus === 'connected' || this.state.sseStatus === 'connecting') {
      return;
    }

    try {
      this.state.sseStatus = 'connecting';
      
      const eventSource = new EventSource('/api/sync');
      this.sseEventSource = eventSource;
      this.sseReconnectAttempts = 0;

      eventSource.addEventListener('open', () => {
        this.state.sseStatus = 'connected';
        this.state.sseLastConnectedAt = nowIso();
        this.sseReconnectAttempts = 0;
      });

      eventSource.addEventListener('message', (event) => {
        try {
          const parsedData = JSON.parse(event.data) as SSEEventData;
          this.handleSSEEvent({ type: 'message', data: parsedData });
        } catch {
        }
      });

      eventSource.addEventListener('connected', (event) => {
        try {
          const parsedData = JSON.parse(event.data) as SSEEventData;
          this.handleSSEEvent({ type: 'connected', data: parsedData });
        } catch {
        }
      });

      eventSource.addEventListener('change', (event) => {
        try {
          const parsedData = JSON.parse(event.data) as SSEEventData;
          this.handleSSEEvent({ type: 'change', data: parsedData });
        } catch {
        }
      });

      eventSource.addEventListener('error', () => {
        this.handleSSEDisconnect();
      });
    } catch {
      this.handleSSEDisconnect();
    }
  }

  async disconnectSSE(): Promise<void> {
    if (this.sseReconnectTimeout) {
      clearTimeout(this.sseReconnectTimeout);
      this.sseReconnectTimeout = null;
    }

    if (this.sseEventSource) {
      this.sseEventSource.close();
      this.sseEventSource = null;
    }

    this.state.sseStatus = 'disconnected';
  }

  private handleSSEDisconnect(): void {
    if (this.state.sseStatus === 'disconnected') {
      return;
    }

    this.state.sseStatus = 'reconnecting';

    if (this.sseReconnectTimeout) {
      clearTimeout(this.sseReconnectTimeout);
    }

    if (this.sseEventSource) {
      this.sseEventSource.close();
      this.sseEventSource = null;
    }

    if (this.sseReconnectAttempts < this.sseMaxReconnectAttempts) {
      const delay = this.sseInitialReconnectDelay * Math.pow(2, this.sseReconnectAttempts);
      this.sseReconnectAttempts++;
      
      this.sseReconnectTimeout = setTimeout(() => {
        this.connectSSE();
      }, delay);
    } else {
      this.state.sseStatus = 'disconnected';
    }
  }

  private handleSSEEvent(event: SSEEvent): void {
    if (event.type === 'change' && this.config.autoSync) {
      this.incrementalSync();
    }

    const listeners = this.sseEventListeners.get(event.type);
    if (listeners) {
      listeners.forEach(listener => listener(event));
    }

    const allListeners = this.sseEventListeners.get('*');
    if (allListeners) {
      allListeners.forEach(listener => listener(event));
    }
  }

  onSSEEvent(eventType: string, listener: (event: SSEEvent) => void): () => void {
    if (!this.sseEventListeners.has(eventType)) {
      this.sseEventListeners.set(eventType, []);
    }
    this.sseEventListeners.get(eventType)!.push(listener);

    return () => {
      const listeners = this.sseEventListeners.get(eventType);
      if (listeners) {
        const index = listeners.indexOf(listener);
        if (index !== -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  getSSEStatus(): SSEConnectionStatus {
    return this.state.sseStatus;
  }

  async cleanup(): Promise<void> {
    await this.stopNetworkMonitoring();
    await this.disconnectSSE();
    if (this.supabaseAdapter) {
      await this.supabaseAdapter.close();
    }
  }
}

let globalSyncManager: CloudSyncManager | null = null;

export function getCloudSyncManager(config?: Partial<SyncConfig>): CloudSyncManager {
  if (!globalSyncManager) {
    globalSyncManager = new CloudSyncManager(config);
  }
  return globalSyncManager;
}

export async function getDatabaseAdapter(): Promise<DatabaseAdapter> {
  const manager = getCloudSyncManager();
  await manager.connect();
  return manager.getAdapter();
}

export async function getLocalDatabaseAdapter(): Promise<DatabaseAdapter> {
  const manager = getCloudSyncManager();
  return manager.getLocalAdapter();
}

export { SQLiteAdapter, SupabaseAdapter };
