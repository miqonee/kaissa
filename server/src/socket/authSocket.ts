import type { Socket } from 'socket.io';
import { verifyToken } from '../auth/auth.js';
import type { Ack } from 'shared';

export type AckFn<T> = (res: Ack<T>) => void;

export interface AuthedSocket {
  uid: number;
  username: string;
}

/** Достать uid из handshake cookie (JWT) */
export function socketAuth(socket: Socket): AuthedSocket | null {
  const cookieHeader = socket.handshake.headers.cookie;
  if (!cookieHeader) return null;
  const token = parseCookie(cookieHeader, 'kaissa_token');
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  return { uid: payload.uid, username: payload.username };
}

export function parseCookie(header: string, name: string): string | null {
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}
