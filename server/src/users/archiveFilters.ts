import type { Prisma } from '@prisma/client';

function utcDay(value: unknown): Date | undefined {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
  const date = new Date(value + 'T00:00:00.000Z');
  if (!Number.isFinite(+date) || date.toISOString().slice(0, 10) !== value) return;
  return date;
}

/** Filters independent of the caller's account and cursor. */
export function archiveFilters(query: Record<string, unknown>): Prisma.GameWhereInput[] {
  const filters: Prisma.GameWhereInput[] = [];
  if (typeof query.gameId === 'string' && /^\d+$/.test(query.gameId)) {
    const id = Number(query.gameId);
    if (id > 0 && id <= 2147483647) filters.push({ id });
  }
  if (query.status === 'active' || query.status === 'finished' || query.status === 'abandoned') {
    filters.push({ status: query.status });
  }
  const from = utcDay(query.from);
  const to = utcDay(query.to);
  if (from || to) filters.push({
    startedAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: new Date(+to + 86_400_000) } : {}) },
  });
  if (query.clock === 'untimed') filters.push({ noClock: true });
  else if (query.clock === 'timed') filters.push({ noClock: false });
  else if (typeof query.clock === 'string' && /^\d{1,3}\+\d{1,3}$/.test(query.clock)) {
    const [baseMin, incSec] = query.clock.split('+').map(Number);
    filters.push({ noClock: false, baseMin, incSec });
  }
  if (query.opponents === 'all-human') filters.push({
    participants: { some: { user: { isBot: false } }, none: { user: { isBot: true } } },
  });
  if (query.opponents === 'with-bots') filters.push({
    participants: { some: { user: { isBot: true } } },
  });
  return filters;
}
