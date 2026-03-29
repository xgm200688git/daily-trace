import { cookies } from "next/headers";
import { getSession, getSessionCookieName } from "./session";
import { getCurrentUserDb, type DatabaseClient } from "./db";

export async function getCurrentUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(getSessionCookieName())?.value;

  if (!sessionId) {
    return null;
  }

  const session = getSession(sessionId);
  if (!session) {
    return null;
  }

  return session.userId;
}

export async function getCurrentUserDbClient(): Promise<DatabaseClient | null> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return null;
  }

  return getCurrentUserDb(userId);
}

export async function requireCurrentUserDbClient(): Promise<DatabaseClient> {
  const client = await getCurrentUserDbClient();
  if (!client) {
    throw new Error("Not authenticated");
  }
  return client;
}
