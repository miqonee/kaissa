import { prisma } from '../prisma.js';

export const GUEST_RETENTION_DAYS = 30;
const HOUR = 60 * 60 * 1000;
export async function touchGuest(user: { id: number; isGuest: boolean; lastSeenAt: Date }): Promise<void> {
  if (!user.isGuest || Date.now() - user.lastSeenAt.getTime() < HOUR) return;
  await prisma.user.updateMany({ where: { id: user.id, isGuest: true }, data: { lastSeenAt: new Date() } });
}

/** Only unused accounts: cascades must never erase a recorded game or its moves. */
export async function cleanupExpiredGuests(protectedIds: number[] = [], now = new Date()): Promise<number> {
  await prisma.user.updateMany({ where: { id: { in: protectedIds }, isGuest: true }, data: { lastSeenAt: now } });
  const cutoff = new Date(now.getTime() - GUEST_RETENTION_DAYS * 24 * HOUR);
  const result = await prisma.user.deleteMany({ where: {
    isGuest: true, isBot: false, isAdmin: false, passwordHash: null,
    wins: 0, losses: 0, draws: 0,
    lastSeenAt: { lt: cutoff }, id: { notIn: protectedIds },
    participations: { none: {} }, moves: { none: {} }, ratingHistory: { none: {} },
  } });
  return result.count;
}
