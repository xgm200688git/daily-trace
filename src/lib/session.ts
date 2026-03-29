import { randomBytes } from "crypto";
import { usersDb, nowIso } from "./db";
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

function fromDbRow(row: {
  id: string;
  user_id: number;
  expires_at: string;
  created_at: string;
}): Session {
  return {
    id: row.id,
    userId: row.user_id,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export async function createSession(userId: number): Promise<Session> {
  const sessionId = generateSessionId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

  await usersDb.run(
    "INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
    [sessionId, userId, expiresAt.toISOString(), nowIso()],
  );

  return {
    id: sessionId,
    userId,
    expiresAt: expiresAt.toISOString(),
    createdAt: nowIso(),
  };
}

export async function getSession(sessionId: string): Promise<Session | undefined> {
  const row = await usersDb.get<{
    id: string;
    user_id: number;
    expires_at: string;
    created_at: string;
  }>(
    "SELECT * FROM sessions WHERE id = ? AND expires_at > ?",
    [sessionId, nowIso()],
  );

  if (!row) {
    return undefined;
  }

  return fromDbRow(row);
}

export async function deleteSession(sessionId: string): Promise<void> {
  await usersDb.run("DELETE FROM sessions WHERE id = ?", [sessionId]);
}

export async function deleteExpiredSessions(): Promise<void> {
  await usersDb.run("DELETE FROM sessions WHERE expires_at <= ?", [nowIso()]);
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

  const row = await usersDb.get<{
    id: number;
    email: string;
    password_hash: string;
    created_at: string;
    updated_at: string;
  }>("SELECT * FROM users WHERE id = ?", [session.userId]);
  if (!row) {
    return undefined;
  }

  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
