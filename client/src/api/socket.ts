import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from 'shared';
import { useAuthStore } from '../stores/auth';
import { useConnectionStore } from '../stores/connection';

let onPageShow: ((event: PageTransitionEvent) => void) | null = null;
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
      void useAuthStore().check();
      // Прошлый сокет умер: комнаты потеряны — восстановить подписки страниц.
      for (const fn of resyncers) {
        try {
          fn();
        } catch {}
      }
    });
    socket.on('disconnect', (reason) => { conn.set('reconnecting'); if (reason === 'io server disconnect') { const current = socket; window.setTimeout(() => { if (current === socket) current?.connect(); }, 700); } });
    socket.on('connect_error', () => conn.set('reconnecting'));

    if (typeof window !== 'undefined') {
      onPageShow = (event) => {
        if (event.persisted && socket && !socket.connected) {
          socket.connect();
        }
      };
      window.addEventListener('pageshow', onPageShow);
    }
  }
  return socket;
}

/** Сброс/закрытие сокета (после логина/логаута) */
export function resetSocket(): void {
  if (onPageShow) { window.removeEventListener('pageshow', onPageShow); onPageShow = null; }
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  useConnectionStore().set('offline');
}
