import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from 'shared';

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
  if (!socket) {
    socket = io('/', { withCredentials: true });
  }
  return socket;
}

/** Переconnect (после логина) */
export function resetSocket(): void {
  socket?.disconnect();
  socket = null;
}
