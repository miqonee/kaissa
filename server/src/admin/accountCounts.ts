import type { AdminAccountCounts } from 'shared';
import { prisma } from '../prisma.js';
import { presence } from '../socket/presence.js';

export async function readAccountCounts(onlineIds = presence.onlineUids()): Promise<AdminAccountCounts> {
  // Roles and game participation do not determine whether a row is a guest.
  // Bot status takes precedence, keeping the three lifetime buckets disjoint.
  const [groups, online] = await Promise.all([
    prisma.user.groupBy({ by: ['isBot', 'isGuest'], _count: { _all: true } }),
    onlineIds.length ? prisma.user.count({ where: { isBot: false, id: { in: onlineIds } } }) : 0,
  ]);
  const counts: AdminAccountCounts = { registered: 0, guests: 0, bots: 0, online };
  for (const group of groups) {
    counts[group.isBot ? 'bots' : group.isGuest ? 'guests' : 'registered'] += group._count._all;
  }
  return counts;
}
