import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";
import type { User } from "./types";

const SALT_ROUNDS = 12;

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
  const supabase = getSupabaseClient();
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const now = new Date().toISOString();

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

export async function getUserByEmail(email: string): Promise<User | undefined> {
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

export async function getUserById(id: number): Promise<User | undefined> {
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

export async function updateUserPassword(userId: number, newPassword: string): Promise<User> {
  const supabase = getSupabaseClient();
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  const now = new Date().toISOString();

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

export async function verifyPassword(plainPassword: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, passwordHash);
}
