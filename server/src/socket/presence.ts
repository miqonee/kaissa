import type { Server as SocketServer } from 'socket.io';
import type { ServerToClientEvents } from 'shared';

// ============================================================
// Presence: какие пользователи онлайн (по числу активных коннектов)
// + рассылка в личные комнаты user:<id>
// ============================================================

export class PresenceHub {
  /** uid -> Set<socketId> */
  private conns = new Map<number, Set<string>>();
  private io: SocketServer<never, ServerToClientEvents> | null = null;

  attach(io: SocketServer<never, ServerToClientEvents>): void {
    this.io = io;
  }

  userRoom(uid: number): string {
    return `user:${uid}`;
  }

  onConnect(uid: number, socketId: string): void {
    let set = this.conns.get(uid);
    if (!set) {
      set = new Set();
      this.conns.set(uid, set);
    }
    set.add(socketId);
  }

  onDisconnect(uid: number, socketId: string): void {
    const set = this.conns.get(uid);
    if (!set) return;
    set.delete(socketId);
    if (set.size === 0) this.conns.delete(uid);
  }

  isOnline(uid: number): boolean {
    return this.conns.has(uid);
  }

  onlineUids(): number[] {
    return [...this.conns.keys()];
  }

  /** Отправить событие во все сокеты пользователя */
  emitToUser(uid: number, event: keyof ServerToClientEvents, payload: unknown): void {
    this.io?.to(this.userRoom(uid)).emit(event, payload as never);
  }
}

export const presence = new PresenceHub();
