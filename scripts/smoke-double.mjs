// Run against a disposable local database and server only.
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { io } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import { MultiChess } from 'shared';

const base = process.env.KAISSA_TEST_BASE_URL ?? '';
const database = new URL(process.env.DATABASE_URL ?? 'http://invalid');
assert(['localhost', '127.0.0.1'].includes(database.hostname) && /test/.test(database.pathname));
assert(/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base));
assert(process.env.JWT_SECRET);
const db = new PrismaClient();
const sockets = [];
const cookie = user => `kaissa_token=${jwt.sign({ uid: user.id, username: user.username, sv: user.sessionVersion }, process.env.JWT_SECRET, { expiresIn: '1h' })}`;
const event = (socket, name, predicate = () => true) => new Promise((resolve, reject) => {
  const timeout = setTimeout(() => { socket.off(name, receive); reject(new Error(`Timed out: ${name}`)); }, 10_000);
  function receive(data) { if (predicate(data)) { clearTimeout(timeout); socket.off(name, receive); resolve(data); } }
  socket.on(name, receive);
});
async function connect(user) {
  const socket = io(base, { autoConnect: false, transports: ['websocket'], extraHeaders: { Cookie: cookie(user) }, reconnection: false });
  sockets.push(socket);
  const ready = event(socket, 'connect'); socket.connect(); await ready;
  return socket;
}
async function api(path, user, body) {
  const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST',
    headers: { Cookie: cookie(user), 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
const ack = (socket, name, ...args) => socket.timeout(6000).emitWithAck(name, ...args);

try {
  const prefix = `double_qa_${Date.now()}`;
  const users = await Promise.all([1, 2, 3, 4, 5].map(i => db.user.create({ data: { username: `${prefix}_${i}` } })));
  const clients = await Promise.all(users.map(connect));
  const created = await api('/api/lobbies', users[0], { name: 'Double Chess QA', mode: 'double',
    private: true, teamMode: 'manual', timeControl: { kind: 'none', baseMin: 0, incSec: 0 } });
  assert.equal(created.status, 201);
  for (let i = 0; i < 4; i++) {
    assert((await ack(clients[i], 'lobby:join', created.body.code)).ok);
    const team = i < 2 ? 1 : 2;
    const assigned = event(clients[i], 'lobby:state', state => state.players.find(p => p.userId === users[i].id)?.teamChoice === team);
    clients[i].emit('lobby:set-team', team); await assigned;
    if (i > 0) {
      const ready = event(clients[i], 'lobby:state', state => state.players.find(p => p.userId === users[i].id)?.ready);
      clients[i].emit('lobby:ready', true); await ready;
    }
  }
  const starting = event(clients[0], 'lobby:started');
  assert((await ack(clients[0], 'lobby:start')).ok);
  const { gameId } = await starting;
  let watching = event(clients[0], 'game:state', state => state.gameId === gameId);
  clients[0].emit('game:watch', gameId);
  let state = await watching;
  assert.equal(state.ratingKind, 'rated');
  assert.deepEqual(state.participants.map(p => [p.userId, p.team, p.multiColor]), [
    [users[0].id, 1, 'yellow'], [users[2].id, 2, 'green'], [users[1].id, 1, 'red'], [users[3].id, 2, 'blue'],
  ]);
  assert.equal((await ack(clients[2], 'game:multi-move', { gameId, from: 'm7', to: 'm5' })).ok, false);
  const byId = new Map(users.map((user, i) => [user.id, clients[i]]));
  for (const [from, to] of [['m2', 'm4'], ['m7', 'm5'], ['e2', 'e4'], ['e7', 'e5']]) {
    const previousPly = state.moveNumber;
    const moved = event(clients[0], 'game:state', update => update.gameId === gameId && update.moveNumber > previousPly);
    assert((await ack(byId.get(state.turnUserIds[0]), 'game:multi-move', { gameId, from, to })).ok);
    state = await moved;
  }
  const originalSeats = state.participants.map(p => [p.userId, p.team, p.seat, p.multiColor]);
  clients[0].disconnect();
  clients[0] = await connect(users[0]);
  watching = event(clients[0], 'game:state', update => update.gameId === gameId);
  clients[0].emit('game:watch', gameId);
  const reconnected = await watching;
  assert.equal(reconnected.moveNumber, 4);
  assert.equal(reconnected.fens[0], state.fens[0]);

  const ended = event(clients[0], 'game:end', update => update.gameId === gameId);
  clients[1].emit('game:resign', gameId);
  assert.deepEqual(((result) => [result.result, result.reason])(await ended), ['0-1', 'resign']);
  const archive = await api(`/api/games/${gameId}`, users[0]);
  assert.equal(archive.status, 200);
  assert.equal(archive.body.moves.length, 4);
  assert.equal(MultiChess.deserializeBoard(archive.body.moves.at(-1).fenAfter).variant, 'double');
  const pgn = await api(`/api/games/${gameId}/pgn`, users[0]);
  assert.equal(pgn.status, 404);
  for (const user of users.slice(0, 4)) {
    const won = [users[2].id, users[3].id].includes(user.id);
    const rating = await db.modeRating.findUniqueOrThrow({ where: { userId_mode: { userId: user.id, mode: 'double' } } });
    assert.equal(rating.rating, won ? 1216 : 1184);
    assert.equal(rating.wins, won ? 1 : 0);
    assert.equal(rating.losses, won ? 0 : 1);
  }

  const invite = event(clients[2], 'game:rematch', update => update.gameId === gameId);
  const rematch = await api(`/api/games/${gameId}/rematch`, users[0], {});
  assert.equal(rematch.status, 200); await invite;
  for (let i = 0; i < 4; i++) {
    assert((await ack(clients[i], 'lobby:join', rematch.body.lobbyId)).ok);
    if (i > 0) {
      const ready = event(clients[i], 'lobby:state', update => update.players.find(p => p.userId === users[i].id)?.ready);
      clients[i].emit('lobby:ready', true); await ready;
    }
  }
  const restarted = event(clients[0], 'lobby:started');
  assert((await ack(clients[0], 'lobby:start')).ok);
  const nextGame = (await restarted).gameId;
  const nextState = event(clients[0], 'game:state', update => update.gameId === nextGame);
  clients[0].emit('game:watch', nextGame);
  assert.deepEqual((await nextState).participants.map(p => [p.userId, p.team, p.seat, p.multiColor]), originalSeats);
  const finished = event(clients[0], 'game:end', update => update.gameId === nextGame);
  clients[0].emit('game:resign', nextGame); await finished;
  console.log('OK: Double Chess HTTP/Socket.IO — manual teams, four colours, turn order, illegal move, reconnect, shared result, team Elo, archive and rematch seats.');
} finally {
  for (const socket of sockets) socket.disconnect();
  await db.$disconnect();
}
