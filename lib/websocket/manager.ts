import type { AuthenticatedSocket } from "./auth";
import { WebSocket } from "ws";

// userId -> Set<AuthenticatedSocket>
const userSockets = new Map<string, Set<AuthenticatedSocket>>();

export function registerSocket(socket: AuthenticatedSocket): void {
  if (!socket.userId) return;
  let set = userSockets.get(socket.userId);
  if (!set) {
    set = new Set();
    userSockets.set(socket.userId, set);
  }
  set.add(socket);
}

export function unregisterSocket(socket: AuthenticatedSocket): void {
  if (!socket.userId) return;
  const set = userSockets.get(socket.userId);
  if (set) {
    set.delete(socket);
    if (set.size === 0) {
      userSockets.delete(socket.userId);
    }
  }
}

export function isUserOnline(userId: string): boolean {
  const set = userSockets.get(userId);
  return !!set && set.size > 0;
}

export function isUserActiveInConversation(userId: string, coupleId: string): boolean {
  const set = userSockets.get(userId);
  if (!set || set.size === 0) return false;
  for (const socket of set) {
    if (
      socket.readyState === WebSocket.OPEN &&
      socket.coupleId === coupleId &&
      socket.isFocused !== false
    ) {
      return true;
    }
  }
  return false;
}

export function setSocketFocusState(socket: AuthenticatedSocket, isFocused: boolean): void {
  socket.isFocused = isFocused;
}

export function sendToUser(userId: string, event: unknown): void {
  const set = userSockets.get(userId);
  if (!set) return;
  const payload = JSON.stringify(event);
  for (const socket of set) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(payload);
    }
  }
}

export function getActiveConnectionsCount(): number {
  let count = 0;
  for (const set of userSockets.values()) {
    count += set.size;
  }
  return count;
}
