import { type NextRequest } from "next/server";
import { getSession, getSessionCookieName } from "@/lib/session";
import {
  registerConnection,
  unregisterConnection,
  broadcastToUser,
  broadcast,
  getActiveConnectionCount,
  getUserConnectionCount,
} from "@/lib/sse-broadcast";

export const dynamic = 'force-dynamic';

interface SSEEvent {
  type: string;
  data: { [key: string]: unknown };
}

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

  const session = await getSession(sessionId);
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const connectionId = generateConnectionId();
  let heartbeatInterval: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      registerConnection(connectionId, controller, session.userId);

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
      unregisterConnection(connectionId);
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


