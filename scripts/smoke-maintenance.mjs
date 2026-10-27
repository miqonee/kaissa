// Disposable local database only. See docs/QA-2026-10-27.md.
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { io } from 'socket.io-client';
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { cleanupExpiredGuests } from '../server/src/auth/guestCleanup.ts';
import { leaderboard } from '../server/src/ratings/leaderboard.ts';
const url = new URL(process.env.DATABASE_URL);
assert(['localhost', '127.0.0.1'].includes(url.hostname) && url.pathname.includes('test'));
const base = process.env.KAISSA_TEST_BASE_URL;
assert(/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base));
const db = new PrismaClient();
const prefix = `maintenance_${Date.now()}`;
const users = [], games = [];
const old = new Date(Date.now() - 40 * 86400000);
async function user(name, data = {}) {
  const u = await db.user.create({ data: { username: `${prefix}_${name}`, ...data } });
  users.push(u); return u;
}
async function game(u, mode, kind, status = 'finished', result = '1-0') {
  const g = await db.game.create({ data: { mode, ratingKind: kind, status, result,
    reason: result === '*' ? 'repetition' : 'resign',
    participants: { create: { userId: u.id, team: 1, color: 'w', boardIndex: 0, ratingBefore: 1300, ratingAfter: 1316 } },
  } });
  games.push(g); return g;
}
const cookie = u => `kaissa_token=${jwt.sign({ uid: u.id, username: u.username, sv: u.sessionVersion }, process.env.JWT_SECRET)}`;
async function get(path, u) { return fetch(base + path, { headers: u ? { Cookie: cookie(u) } : {} }); }
try {
  const player = await user('player', { rating: 1470 });
  const practice = await user('practice');
  const carried = await user('carried', { wins: 7, losses: 7, rating: 1300 });
  await db.modeRating.create({ data: { userId: carried.id, mode: 'team', rating: 1370, carriedRating: 1300, carriedWins: 7, carriedLosses: 7 } });
  const carriedRow = (await leaderboard('team')).find(r => r.userId === carried.id);
  assert.deepEqual([carriedRow.totalGames, carriedRow.wins, carriedRow.losses, carriedRow.rating, carriedRow.hasRating, carriedRow.provisional], [14, 7, 7, 1370, true, false]);

  const historicalOnly = await user('totals_only', { wins: 7, losses: 7, rating: 1196 });
  const partialArchive = await user('partial_archive', { wins: 4, losses: 26, rating: 1131 });
  await game(partialArchive, 'team', null);
  await game(partialArchive, 'bughouse', null, 'finished', '0-1');
  const stale = await user('stale', { isGuest: true, lastSeenAt: old });
  const saved = await user('saved', { lastSeenAt: old });
  const guest = await user('guest', { isGuest: true, lastSeenAt: old });
  const protectedGuest = await user('online', { isGuest: true, lastSeenAt: old });
  const recentGuest = await user('recent', { isGuest: true });
  const guestWithTotals = await user('guest_totals', { isGuest: true, lastSeenAt: old, wins: 2 });
  const recorded = await game(guest, 'team', 'guest');
  const historical = await game(player, 'team', null, 'finished', '*');
  await game(player, 'team', 'rated');
  await game(player, 'bughouse', 'bots');
  await game(player, 'team', 'guest', 'abandoned', '*');
  await game(practice, 'team', 'bots');
  await db.modeRating.create({ data: { userId: player.id, mode: 'team', rating: 1216, wins: 1 } });
  const all = (await leaderboard('all')).find(r => r.userId === player.id);
  assert.deepEqual([all.totalGames, all.ratedGames, all.trainingGames, all.legacyGames, all.wins, all.draws, all.legacyRating], [3, 1, 1, 1, 2, 1, 1470]);
  const totals = await leaderboard('all');
  const savedTotals = totals.find(r => r.userId === historicalOnly.id);
  assert.deepEqual([savedTotals.totalGames, savedTotals.wins, savedTotals.losses, savedTotals.unarchivedGames], [14, 7, 7, 14]);
  const partial = totals.find(r => r.userId === partialArchive.id);
  assert.deepEqual([partial.totalGames, partial.wins, partial.losses, partial.unarchivedGames], [30, 4, 26, 28]);
  const team = await leaderboard('team');
  assert(!team.some(r => r.userId === historicalOnly.id));
  assert.equal(team.find(r => r.userId === partialArchive.id).totalGames, 1);
  const row = team.find(r => r.userId === player.id);
  assert.equal(row.totalGames, 2); assert.equal(row.rating, 1216);
  assert(team.some(r => r.userId === practice.id && r.totalGames === 1 && r.ratedGames === 0));
  assert(!team.some(r => r.userId === guest.id));
  console.log('OK: all modes, historical draws, training-only players, rated Elo, cancelled games excluded');

  assert.equal(await cleanupExpiredGuests([protectedGuest.id]), 1);
  assert.equal(await db.user.findUnique({ where: { id: stale.id } }), null);
  for (const u of [saved, guest, protectedGuest, recentGuest, guestWithTotals]) assert(await db.user.findUnique({ where: { id: u.id } }));
  assert(await db.gameParticipant.findUnique({ where: { gameId_userId: { gameId: recorded.id, userId: guest.id } } }));
  console.log('OK: expired empty guest deleted; registered, recent, online and historical participants preserved');

  for (const path of ['/api/games/archive', '/api/games/mine', `/api/games/${historical.id}`, `/api/games/${historical.id}/pgn`]) {
    assert.equal((await get(path)).status, 401, path);
    assert.equal((await get(path, guest)).status, 403, path);
    assert.equal((await get(path, player)).status, 200, path);
  }
  const publicProfile = await (await get(`/api/users/${player.username}`)).json();
  assert.equal(publicProfile.recentGames.length, 0);
  for (const u of [undefined, guest, player]) {
    const socket = io(base, { transports: ['websocket'], extraHeaders: u ? { Cookie: cookie(u) } : {}, reconnection: false });
    try {
      const event = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Archive socket timeout')), 5000);
        socket.on('connect', () => socket.emit('game:watch', historical.id));
        for (const name of ['game:state', 'game:unavailable']) socket.on(name, () => { clearTimeout(timer); resolve(name); });
      });
      assert.equal(event, u === player ? 'game:state' : 'game:unavailable');
    } finally { socket.disconnect(); }
  }
  console.log('OK: anonymous and guest archive denied over HTTP and socket; registered archive/replay/PGN allowed');

  for (const lang of ['', '?lang=en']) {
    const response = await get(`/players/${player.username}${lang}`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert(html.includes(`rel="canonical" href="https://duochess.ru/players/${player.username}${lang}"`));
    assert(html.includes(`<title>${player.username}`));
    assert.equal((html.match(/rel="canonical"/g) ?? []).length, 1);
    assert(!html.includes('"@type":"WebSite"'));
  }
  assert.equal((await get(`/players/${prefix}_missing`)).status, 404);
  assert.equal((await get(`/players/${guest.username}`)).headers.get('x-robots-tag'), 'noindex, follow');
  console.log('OK: unique RU/EN profile metadata, missing profile HTTP 404, guests noindex');
  const bot = await user('bot', { isBot: true, rating: 1500 });
  const botGame = await game(bot, 'team', 'bots');
  const mixedGame = await game(player, 'team', 'bots');
  await db.gameParticipant.create({ data: { gameId: mixedGame.id, userId: bot.id, team: 2, color: 'b', boardIndex: 0, ratingBefore: 1500 } });
  const beforeUser = await db.user.findUnique({ where: { id: partialArchive.id } });
  await db.ratingHistory.create({ data: { userId: player.id, gameId: historical.id, value: 1470, delta: 16 } });
  execFileSync(process.execPath, ['scripts/reset-bot-stats.mjs'], { stdio: 'pipe' });
  assert.equal(await db.game.findUnique({ where: { id: botGame.id } }), null);
  for (const g of [historical, mixedGame]) assert(await db.game.findUnique({ where: { id: g.id } }));
  assert.deepEqual(await db.user.findUnique({ where: { id: partialArchive.id } }), beforeUser);
  assert.equal(await db.ratingHistory.count({ where: { userId: player.id } }), 1);
  assert.equal(await db.gameParticipant.count({ where: { gameId: mixedGame.id } }), 2);
  console.log('OK: bot reset preserves human/mixed games, lifetime counters and rating history');

} finally {
  await db.game.deleteMany({ where: { id: { in: games.map(g => g.id) } } });
  await db.user.deleteMany({ where: { id: { in: users.map(u => u.id) } } });
  await db.$disconnect();
}
