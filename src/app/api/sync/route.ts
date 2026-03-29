import { type NextRequest } from "next/server";
import { getSession, getSessionCookieName } from "@/lib/session";

export const dynamic = 'force-dynamic';

interface SSEEventData {
  [key: string]: unknown;
}

interface SSEEvent {
  type: string;
  data: SSEEventData;
}

interface ActiveConnection {
  controller: ReadableStreamDefaultController;
  userId: number;
  createdAt: string;
}

const activeConnections = new Map<string, ActiveConnection>();

function generateConnectionId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function formatSSE(event: SSEEvent): string {
  let result = "";
  if (event.type) {
    result += `event: ${event.type}\n`;
  }
  result += `data: ${JSON.stringify(event.data)}\n\n`;
  return result;
}

async function sendHeartbeat(controller: ReadableStreamDefaultController) {
  try {
    controller.enqueue(new TextEncoder().encode(": heartbeat\n\n"));
  } catch {
  }
}

export async function GET(request: NextRequest) {
  const cookieName = getSessionCookieName();
  const sessionId = request.cookies.get(cookieName)?.value;

  if (!sessionId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const session = getSession(sessionId);
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const connectionId = generateConnectionId();
  let heartbeatInterval: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      activeConnections.set(connectionId, {
        controller,
        userId: session.userId,
        createdAt: new Date().toISOString(),
      });

      controller.enqueue(new TextEncoder().encode(formatSSE({
        type: "connected",
        data: { connectionId, userId: session.userId, timestamp: new Date().toISOString() }
      })));

      heartbeatInterval = setInterval(() => {
        sendHeartbeat(controller);
      }, 30000);
    },
    cancel() {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
      activeConnections.delete(connectionId);
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function broadcastToUser(userId: number, event: SSEEvent) {
  const connections = Array.from(activeConnections.values());
  const userConnections = connections.filter(conn => conn.userId === userId);
  
  for (const conn of userConnections) {
    try {
      conn.controller.enqueue(new TextEncoder().encode(formatSSE(event)));
    } catch {
    }
  }
}

function broadcast(event: SSEEvent) {
  const connections = Array.from(activeConnections.values());
  
  for (const conn of connections) {
    try {
      conn.controller.enqueue(new TextEncoder().encode(formatSSE(event)));
    } catch {
    }
  }
}

function getActiveConnectionCount(): number {
  return activeConnections.size;
}

function getUserConnectionCount(userId: number): number {
  return Array.from(activeConnections.values()).filter(conn => conn.userId === userId).length;
}
