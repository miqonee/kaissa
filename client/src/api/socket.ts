import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from 'shared';
import { useConnectionStore } from '../stores/connection';

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

/** Переподписка на реконнекте: страницы регистрируют свой resync здесь. */
const resyncers = new Set<() => void>();

export function onSocketResync(fn: () => void): () => void {
  resyncers.add(fn);
  return () => resyncers.delete(fn);
}

export function getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
  if (!socket) {
    socket = io('/', {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });
    const conn = useConnectionStore();

    socket.on('connect', () => {
      conn.set('connected');
      // Прошлый сокет умер: комнаты потеряны — восстановить подписки страниц.
      for (const fn of resyncers) {
        try {
          fn();
        } catch {}
      }
    });
    socket.on('disconnect', () => conn.set('reconnecting'));
    socket.on('connect_error', () => conn.set('reconnecting'));
  }
  return socket;
}

/** Сброс/закрытие сокета (после логина/логаута) */
export function resetSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  useConnectionStore().set('offline');
}
