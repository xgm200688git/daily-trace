import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const USE_SUPABASE = SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

type SqlValue = string | number | null;

export interface DatabaseClient {
  raw: any;
  get<T>(sql: string, params?: SqlValue[]): T | undefined;
  all<T>(sql: string, params?: SqlValue[]): T[];
  run(sql: string, params?: SqlValue[]): { changes: number; lastInsertRowid?: number | string | bigint };
  transaction<T>(fn: () => T): T;
}

class SupabaseDatabaseClient implements DatabaseClient {
  private client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  get raw() {
    return this.client;
  }

  get<T>(sql: string, params: SqlValue[] = []): T | undefined {
    // 同步方法，但在 Supabase 中我们需要异步
    // 这里返回 undefined，实际使用时应该用异步方法
    console.warn('Synchronous get() called in Supabase mode. Use async methods instead.');
    return undefined;
  }

  all<T>(sql: string, params: SqlValue[] = []): T[] {
    console.warn('Synchronous all() called in Supabase mode. Use async methods instead.');
    return [];
  }

  run(sql: string, params: SqlValue[] = []): { changes: number; lastInsertRowid?: number | string | bigint } {
    console.warn('Synchronous run() called in Supabase mode. Use async methods instead.');
    return { changes: 0 };
  }

  transaction<T>(fn: () => T): T {
    return fn();
  }
}

let supabaseClientInstance: SupabaseClient | null = null;
let supabaseDbInstance: SupabaseDatabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClientInstance) {
    supabaseClientInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseClientInstance;
}

export function getSupabaseDb(): DatabaseClient {
  if (!supabaseDbInstance) {
    supabaseDbInstance = new SupabaseDatabaseClient(getSupabaseClient());
  }
  return supabaseDbInstance;
}

export function isSupabaseEnabled(): boolean {
  return USE_SUPABASE;
}

// 导出 Supabase 客户端供直接使用
export const supabase = USE_SUPABASE ? getSupabaseClient() : null;
