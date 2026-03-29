export interface SSEEventData {
  [key: string]: unknown;
}

export interface SSEEvent {
  type: string;
  data: SSEEventData;
}

const activeConnections = new Map<string, {
  controller: ReadableStreamDefaultController;
  userId: number;
  createdAt: string;
}>();

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

export function registerConnection(
  connectionId: string,
  controller: ReadableStreamDefaultController,
  userId: number
): void {
  activeConnections.set(connectionId, {
    controller,
    userId,
    createdAt: new Date().toISOString(),
  });
}

export function unregisterConnection(connectionId: string): void {
  activeConnections.delete(connectionId);
}

export function broadcastToUser(userId: number, event: SSEEvent): void {
  const connections = Array.from(activeConnections.values());
  const userConnections = connections.filter(conn => conn.userId === userId);
  
  for (const conn of userConnections) {
    try {
      conn.controller.enqueue(new TextEncoder().encode(formatSSE(event)));
    } catch {
    }
  }
}

export function broadcast(event: SSEEvent): void {
  const connections = Array.from(activeConnections.values());
  
  for (const conn of connections) {
    try {
      conn.controller.enqueue(new TextEncoder().encode(formatSSE(event)));
    } catch {
    }
  }
}

export function getActiveConnectionCount(): number {
  return activeConnections.size;
}

export function getUserConnectionCount(userId: number): number {
  return Array.from(activeConnections.values()).filter(conn => conn.userId === userId).length;
}
