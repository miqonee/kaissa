import type { Socket } from 'socket.io';
import { verifyToken } from '../auth/auth.js';
import { prisma } from '../prisma.js';
import type { Ack } from 'shared';
export type AckFn<T> = (res: Ack<T>) => void;
export interface AuthedSocket { uid: number; username: string; sv: number }
export async function socketAuth(socket: Socket): Promise<AuthedSocket | null> {
  const token = parseCookie(socket.handshake.headers.cookie ?? '', 'kaissa_token');
  const p = token ? verifyToken(token) : null;
  if (!p) return null;
  const user = await prisma.user.findUnique({ where: { id: p.uid } });
  return user && user.sessionVersion === p.sv ? { uid: user.id, username: user.username, sv: p.sv } : null;
}
export function parseCookie(header: string, name: string): string | null {
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) { try { return decodeURIComponent(rest.join('=')); } catch { return null; } }
  }
  return null;
}
