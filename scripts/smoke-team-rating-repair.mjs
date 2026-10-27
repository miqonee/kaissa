// Creates an isolated schema in a disposable LOCAL test database.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { fixture } from '../server/tests/fixtures/team-repair.ts';
const baseUrl = new URL(process.env.DATABASE_URL ?? 'http://invalid');
assert(['localhost', '127.0.0.1'].includes(baseUrl.hostname) && baseUrl.pathname.includes('test'));
const schema = `repair_test_${Date.now()}`;
const admin = new PrismaClient();
await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
const target = new URL(baseUrl); target.searchParams.set('schema', schema);
process.env.DATABASE_URL = target.href;
execFileSync('npx', ['prisma', 'migrate', 'deploy', '--schema', 'server/prisma/schema.prisma'], { stdio: 'pipe', env: process.env });
const { prisma: db } = await import('../server/src/prisma.ts');
const { repairTeamRatings } = await import('../server/src/ratings/repairTeam.ts');
const { TEAM_REPAIR_KEY } = await import('../server/src/ratings/teamRepairPlan.ts');
const { leaderboard } = await import('../server/src/ratings/leaderboard.ts');
const { loadPlayerRatings, saveGameResult } = await import('../server/src/ratings/service.ts');
const { BOT_PRESETS } = await import('../shared/dist/index.js');
const input = fixture();
let successful = false;
async function snapshot() {
  return JSON.stringify({ users: await db.user.findMany({ orderBy: { id: 'asc' } }),
    ratings: await db.modeRating.findMany({ orderBy: [{ userId: 'asc' }, { mode: 'asc' }] }),
    participants: await db.gameParticipant.findMany({ orderBy: { id: 'asc' } }),
    history: await db.ratingHistory.findMany({ orderBy: { id: 'asc' } }) });
}
try {
  for (const u of input.users) await db.user.create({ data: { ...u, username: u.isBot ? BOT_PRESETS[u.id - 3].username : `QA_${u.username}`, passwordHash: null } });
  for (const r of input.ratings) await db.modeRating.create({ data: r });
  for (const g of input.games) {
    const { participants, ...data } = g;
    await db.game.create({ data: { ...data, participants: { create: participants.map(p => ({ ...p, color: p.team === 1 ? 'w' : 'b', boardIndex: 0 })) } } });
  }
  for (const h of input.history) await db.ratingHistory.create({ data: h });
  // Advance sequences after explicit fixture IDs so real writes can allocate new IDs.
  for (const table of ['User', 'Game', 'GameParticipant', 'RatingHistory'])
    await db.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), (SELECT MAX(id) FROM "${table}"))`);
  const initial = await snapshot();
  assert.equal((await repairTeamRatings(false, db)).status, 'preview');
  assert.equal(await snapshot(), initial);
  assert.equal(await db.dataPatch.count(), 0);
  await db.game.update({ where: { id: 1 }, data: { status: 'active' } });
  await assert.rejects(() => repairTeamRatings(true, db), /активные/);
  await db.game.update({ where: { id: 1 }, data: { status: 'finished' } });
  assert.equal(await snapshot(), initial);
  await db.$executeRawUnsafe(`CREATE FUNCTION refuse_patch() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'simulated audit failure'; END $$`);
  await db.$executeRawUnsafe(`CREATE TRIGGER refuse_patch BEFORE INSERT ON "DataPatch" FOR EACH ROW EXECUTE FUNCTION refuse_patch()`);
  await assert.rejects(() => repairTeamRatings(true, db), /simulated audit failure/);
  assert.equal(await snapshot(), initial);
  assert.equal(await db.dataPatch.count(), 0);
  await db.$executeRawUnsafe('DROP TRIGGER refuse_patch ON "DataPatch"');
  const results = await Promise.all([repairTeamRatings(true, db), repairTeamRatings(true, db)]);
  assert.deepEqual(results.map(r => r.status).sort(), ['already-applied', 'applied']);
  const once = await snapshot();
  assert.equal((await repairTeamRatings(true, db)).status, 'already-applied');
  assert.equal(await snapshot(), once);
  const audit = await db.dataPatch.findUniqueOrThrow({ where: { key: TEAM_REPAIR_KEY } });
  assert.equal(audit.details.before.ratings.find(r => r.userId === 1).rating, 1215);
  assert.equal(audit.details.baselineIds.length, 2);
  const board = (await leaderboard('team')).find(r => r.userId === 1);
  assert.deepEqual([board.totalGames, board.wins, board.losses, board.draws, board.rating, board.hasRating, board.provisional], [18, 12, 5, 1, 1488, true, false]);
  const prepared = await loadPlayerRatings(input.users.map(u => ({ uid: u.id, username: u.username, rating: 1200, isBot: u.isBot, isGuest: false })), 'team');
  assert.equal(prepared[0].rating, 1488); assert.equal(prepared[1].rating, 1012);
  const next = await db.game.create({ data: { mode: 'team', ratingKind: 'rated',
    participants: { create: prepared.map(p => ({ userId: p.uid, team: p.uid % 2 ? 1 : 2, color: p.uid % 2 ? 'w' : 'b', boardIndex: 0, ratingBefore: p.rating })) } } });
  const game = { id: next.id, mode: 'team', ratingKind: 'rated', participants: prepared.map(p => ({ ...p, team: p.uid % 2 ? 1 : 2, ratingBefore: p.rating, ratingAfter: null })) };
  await Promise.all([saveGameResult(game, '1-0', 'resign'), saveGameResult(game, '1-0', 'resign')]);
  const after = await db.modeRating.findUniqueOrThrow({ where: { userId_mode: { userId: 1, mode: 'team' } } });
  assert.equal(after.carriedWins, 10); assert.equal(after.wins, 2); assert(after.rating > 1488);
  assert.equal(await db.ratingHistory.count({ where: { userId: 1, gameId: next.id } }), 1);
  assert.equal((await leaderboard('team')).find(r => r.userId === 1).totalGames, 19);
  assert.equal((await repairTeamRatings(true, db)).status, 'already-applied');
  console.log('OK: dry-run unchanged, active-game refusal, atomic rollback, concurrent one-time application, original-value audit, restored leaderboard, next game uses restored Elo, repeated finalization safe');
  successful = true;
  if (process.argv.includes('--keep')) {
    const quote = s => `'${s.replaceAll("'", "'\\''")}'`;
    writeFileSync('/tmp/chess-repair-preview.env', `export DATABASE_URL=${quote(target.href)}\nexport JWT_SECRET=local-test-only-secret-at-least-thirty-two-characters\nexport NODE_ENV=test\nexport DEMO_ENABLED=false\nexport PORT=4427\n`, { mode: 0o600 });
    console.log(`Preview schema kept: ${schema}`);
  }
} finally {
  await db.$disconnect();
  if (!successful || !process.argv.includes('--keep')) await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  await admin.$disconnect();
}
