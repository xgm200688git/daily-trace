import { db, nowIso, type DatabaseClient } from "@/lib/db";
import {
  hashPassword,
  verifyPassword,
  generateToken,
  generateResetToken,
  isAuthEnabled,
} from "@/lib/auth";

export interface UserRecord {
  id: number;
  email: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

function mapUser(row: {
  id: number;
  email: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
}): UserRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function registerUser(
  email: string,
  password: string,
  client: DatabaseClient = db,
): Promise<{ user: UserRecord; token: string }> {
  const existingUser = client.get<{ id: number }>(
    "SELECT id FROM users WHERE email = ?",
    [email],
  );

  if (existingUser) {
    throw new Error("Email already registered");
  }

  const hashedPassword = await hashPassword(password);
  const now = nowIso();

  const result = client.raw.prepare(
    `
      INSERT INTO users (email, password_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `,
  ).run(email, hashedPassword, now, now);

  const userId = result.lastInsertRowid as number;

  const user = client.get<{
    id: number;
    email: string;
    password_hash: string;
    created_at: string;
    updated_at: string;
  }>("SELECT * FROM users WHERE id = ?", [userId])!;

  const token = generateToken({ userId: user.id, email: user.email });

  return { user: mapUser(user), token };
}

export async function loginUser(
  email: string,
  password: string,
  client: DatabaseClient = db,
): Promise<{ user: UserRecord; token: string } | null> {
  const userRow = client.get<{
    id: number;
    email: string;
    password_hash: string;
    created_at: string;
    updated_at: string;
  }>("SELECT * FROM users WHERE email = ?", [email]);

  if (!userRow) {
    return null;
  }

  const isValidPassword = await verifyPassword(password, userRow.password_hash);
  if (!isValidPassword) {
    return null;
  }

  const token = generateToken({ userId: userRow.id, email: userRow.email });

  return { user: mapUser(userRow), token };
}

export async function getUserById(
  userId: number,
  client: DatabaseClient = db,
): Promise<UserRecord | null> {
  const userRow = client.get<{
    id: number;
    email: string;
    password_hash: string;
    created_at: string;
    updated_at: string;
  }>("SELECT * FROM users WHERE id = ?", [userId]);

  if (!userRow) {
    return null;
  }

  return mapUser(userRow);
}

export async function createPasswordResetToken(
  email: string,
  client: DatabaseClient = db,
): Promise<string | null> {
  const userRow = client.get<{ id: number }>(
    "SELECT id FROM users WHERE email = ?",
    [email],
  );

  if (!userRow) {
    return null;
  }

  const token = generateResetToken();
  const now = nowIso();
  const expiresAt = new Date(Date.now() + 3600000).toISOString();

  client.run(
    `
      INSERT INTO password_reset_tokens (user_id, token, expires_at, created_at)
      VALUES (?, ?, ?, ?)
    `,
    [userRow.id, token, expiresAt, now],
  );

  return token;
}

export async function resetPassword(
  token: string,
  newPassword: string,
  client: DatabaseClient = db,
): Promise<boolean> {
  const now = nowIso();
  const resetTokenRow = client.get<{
    id: number;
    user_id: number;
    expires_at: string;
  }>(
    `
      SELECT id, user_id, expires_at FROM password_reset_tokens
      WHERE token = ? AND expires_at > ?
    `,
    [token, now],
  );

  if (!resetTokenRow) {
    return false;
  }

  const hashedPassword = await hashPassword(newPassword);

  client.run(
    "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
    [hashedPassword, now, resetTokenRow.user_id],
  );

  client.run("DELETE FROM password_reset_tokens WHERE id = ?", [resetTokenRow.id]);

  return true;
}

export function getCurrentUserId(): number | null {
  if (!isAuthEnabled()) {
    return null;
  }
  return null;
}
