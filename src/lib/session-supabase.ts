import { randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";
import type { User } from "@/features/auth/types";

const SESSION_COOKIE_NAME = "dt_session_id";
const SESSION_EXPIRES_DAYS = 7;
const SESSION_ID_LENGTH = 32;

export interface Session {
  id: string;
  userId: number;
  expiresAt: string;
  createdAt: string;
}

function generateSessionId(): string {
  return randomBytes(SESSION_ID_LENGTH).toString("hex");
}

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    throw new Error("Supabase credentials not configured");
  }
  
  return createClient(url, key);
}

export async function createSession(userId: number): Promise<Session> {
  const supabase = getSupabaseClient();
  const sessionId = generateSessionId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

  const { error } = await supabase
    .from('sessions')
    .insert([
      {
        id: sessionId,
        user_id: userId,
        expires_at: expiresAt.toISOString(),
        created_at: now.toISOString(),
      },
    ]);

  if (error) {
    throw new Error(`Failed to create session: ${error.message}`);
  }

  return {
    id: sessionId,
    userId,
    expiresAt: expiresAt.toISOString(),
    createdAt: now.toISOString(),
  };
}

export async function getSession(sessionId: string): Promise<Session | undefined> {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();
  
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .gt('expires_at', now)
    .single();

  if (error || !data) {
    return undefined;
  }

  return {
    id: data.id,
    userId: data.user_id,
    expiresAt: data.expires_at,
    createdAt: data.created_at,
  };
}

export async function deleteSession(sessionId: string): Promise<void> {
  const supabase = getSupabaseClient();
  
  await supabase
    .from('sessions')
    .delete()
    .eq('id', sessionId);
}

export async function deleteExpiredSessions(): Promise<void> {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();
  
  await supabase
    .from('sessions')
    .delete()
    .lt('expires_at', now);
}

export function getSessionCookieName(): string {
  return SESSION_COOKIE_NAME;
}

export function getSessionExpiresDays(): number {
  return SESSION_EXPIRES_DAYS;
}

export async function getSessionUser(sessionId: string): Promise<User | undefined> {
  const session = await getSession(sessionId);
  if (!session) {
    return undefined;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', session.userId)
    .single();

  if (error || !data) {
    return undefined;
  }

  return {
    id: data.id,
    email: data.email,
    passwordHash: data.password_hash,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}
