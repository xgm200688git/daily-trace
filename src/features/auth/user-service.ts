import bcrypt from "bcryptjs";
import { usersDb, nowIso } from "../../lib/db";
import { createClient } from "@supabase/supabase-js";
import type { User } from "./types";

const SALT_ROUNDS = 12;

const USE_SUPABASE = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    throw new Error("Supabase credentials not configured");
  }
  
  return createClient(url, key);
}

function fromDbRow(row: any): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createUser(email: string, password: string): Promise<User> {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const now = nowIso();

  if (USE_SUPABASE) {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('users')
      .insert([
        {
          email,
          password_hash: passwordHash,
          created_at: now,
          updated_at: now,
        },
      ])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }

    return fromDbRow(data);
  }

  const result = await usersDb.run(
    "INSERT INTO users (email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?)",
    [email, passwordHash, now, now],
  );

  const user = await usersDb.get<{
    id: number;
    email: string;
    password_hash: string;
    created_at: string;
    updated_at: string;
  }>(
    "SELECT * FROM users WHERE id = ?",
    [result.lastInsertRowid as number],
  );

  if (!user) {
    throw new Error("Failed to create user");
  }

  return fromDbRow(user);
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  if (USE_SUPABASE) {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !data) {
      return undefined;
    }

    return fromDbRow(data);
  }

  const row = await usersDb.get<{
    id: number;
    email: string;
    password_hash: string;
    created_at: string;
    updated_at: string;
  }>(
    "SELECT * FROM users WHERE email = ?",
    [email],
  );

  if (!row) {
    return undefined;
  }

  return fromDbRow(row);
}

export async function getUserById(id: number): Promise<User | undefined> {
  if (USE_SUPABASE) {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return undefined;
    }

    return fromDbRow(data);
  }

  const row = await usersDb.get<{
    id: number;
    email: string;
    password_hash: string;
    created_at: string;
    updated_at: string;
  }>(
    "SELECT * FROM users WHERE id = ?",
    [id],
  );

  if (!row) {
    return undefined;
  }

  return fromDbRow(row);
}

export async function updateUserPassword(userId: number, newPassword: string): Promise<User> {
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  const now = nowIso();

  if (USE_SUPABASE) {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('users')
      .update({
        password_hash: passwordHash,
        updated_at: now,
      })
      .eq('id', userId)
      .select()
      .single();

    if (error || !data) {
      throw new Error("User not found");
    }

    return fromDbRow(data);
  }

  await usersDb.run(
    "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
    [passwordHash, now, userId],
  );

  const user = await getUserById(userId);

  if (!user) {
    throw new Error("User not found");
  }

  return user;
}

export async function verifyPassword(plainPassword: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, passwordHash);
}
