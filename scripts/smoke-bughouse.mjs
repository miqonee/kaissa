// Run only against a disposable local server/database. Creates a test user,
// plays one human-controlled seat with three real bots, checks replay/rematch.
import assert from 'node:assert/strict';
import { io } from 'socket.io-client';
import { BughouseGame, isDrop } from 'shared/bughouse';
import { chooseBughouseMove } from '../server/dist/ai/bughouse.js';
import { fairyPool } from '../server/dist/ai/fairyStockfish.js';

const base = new URL(process.env.KAISSA_TEST_URL || 'http://127.0.0.1:4000');
assert(['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname), 'Use a disposable localhost server');
let cookie = '';
async function api(path, body) {
  const res = await fetch(new URL(path, base), { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (res.headers.get('set-cookie')) cookie = res.headers.get('set-cookie').split(';')[0];
  const data = await res.json();
  assert(res.ok, JSON.stringify(data));
  return data;
}
const { user } = await api('/api/auth/register', { username: `qa_smoke_${Date.now().toString(36)}`, password: 'local-bughouse-test-2026' });
let socket;
let latest;
let gameId;
try {
  socket = io(base.origin, { transports: ['websocket'], extraHeaders: { Cookie: cookie }, reconnection: false });
  await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
  const ack = (event, ...args) => socket.timeout(10_000).emitWithAck(event, ...args).then(res => { assert(res.ok, res.error); return res.data; });
  socket.on('game:state', state => { if (state.participants.some(p => p.userId === user.id)) latest = state; });
  socket.on('game:end', data => { if (latest?.gameId === data.gameId) latest = { ...latest, status: 'finished', ...data }; });
  const { lobby, code } = await api('/api/lobbies', { name: 'Bughouse smoke test', mode: 'bughouse', timeControl: { kind: 'none', baseMin: 0, incSec: 0 }, private: true });
  await ack('lobby:join', code);
  for (let i = 0; i < 3; i++) await ack('lobby:add-bot');
  socket.emit('lobby:ready', true);
  ({ gameId } = await ack('lobby:start'));
  latest = (await api(`/api/games/${gameId}/state`)).state;
  assert.equal(latest.rulesVersion, 2);
  assert.equal(latest.participants.filter(p => p.isBot).length, 3);
  const me = latest.participants.find(p => p.userId === user.id);
  assert(latest.botPacing, 'Solo clock-free bughouse must be paced');
  const deadline = Date.now() + 210_000;
  let lastPrinted = 0;
  let movesByHuman = 0;
  let reconnected = false;
  let pacedWaitTested = false;
  while (latest.status === 'active' && Date.now() < deadline && latest.moveNumber < 100) {
    if (latest.moveNumber >= lastPrinted + 10) { console.log(`game ${gameId}: ${latest.moveNumber} halfmoves`); lastPrinted = latest.moveNumber; }
    if (!reconnected && latest.moveNumber >= 16) {
      const prior = latest.moveNumber;
      await ack('game:set-paused', { gameId, paused: true });
      const pausedPly = (await api(`/api/games/${gameId}/state`)).state.moveNumber;
      await new Promise(resolve => setTimeout(resolve, 1600));
      assert.equal((await api(`/api/games/${gameId}/state`)).state.moveNumber, pausedPly, 'Pause stops both boards');
      await ack('game:set-paused', { gameId, paused: false });
      socket.disconnect();
      await new Promise(resolve => setTimeout(resolve, 300));
      assert.equal((await api(`/api/games/${gameId}/state`)).state.botPacing.paused, true, 'Disconnect auto-pauses');
      socket.connect();
      await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
      socket.emit('game:watch', gameId);
      latest = (await api(`/api/games/${gameId}/state`)).state;
      assert(latest.moveNumber >= prior); assert(latest.botPacing.paused, 'Reconnect does not auto-resume');
      await ack('game:set-paused', { gameId, paused: false }); reconnected = true;
    }
    if (latest.turnUserIds[me.boardIndex] === user.id) {
      if (!pacedWaitTested && latest.moveNumber >= 4) {
        await new Promise(resolve => setTimeout(resolve, 3500));
        const waiting = (await api(`/api/games/${gameId}/state`)).state;
        assert(waiting.botPacing.waiting);
        const waitingPly = waiting.moveNumber;
        await new Promise(resolve => setTimeout(resolve, 2500));
        assert.equal((await api(`/api/games/${gameId}/state`)).state.moveNumber, waitingPly, 'Bots wait while the human thinks');
        pacedWaitTested = true;
      }
      const state = latest;
      const game = new BughouseGame(state.fens);
      for (let i = 0; i < state.participants.length; i++) {
        const player = state.participants[i];
        Object.assign(game.pocketOf(player.boardIndex, player.color), state.pockets[i]);
      }
      const move = await chooseBughouseMove(game.snapshot(), me.boardIndex, 2000, 30_000);
      assert(move, 'Human seat must have a legal variant move');
      const result = await socket.timeout(10_000).emitWithAck('game:move', { gameId, boardIndex: me.boardIndex, from: isDrop(move) ? '-' : move.from, to: move.to, ...(isDrop(move) ? { dropPiece: move.piece } : { promotion: move.promotion }) });
      if (result.ok) movesByHuman++;
      else assert(latest.status !== 'active' || /ход|Партия|время/i.test(result.error), result.error);
    }
    await new Promise(resolve => setTimeout(resolve, 60));
  }
  if (latest.status === 'active') {
    socket.emit('game:resign', gameId);
    for (let i = 0; i < 100 && latest.status === 'active'; i++) await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.notEqual(latest.status, 'active', 'Match must finish');
  const record = await api(`/api/games/${gameId}`);
  const moves = record.moves.slice().sort((a, b) => a.ply - b.ply);
  assert.deepEqual(moves.map(m => m.ply), moves.map((_, i) => i + 1));
  const replay = new BughouseGame();
  for (const move of moves) {
    const result = replay.apply(move.dropPiece ? { board: move.boardIndex, piece: move.dropPiece, to: move.to } : { board: move.boardIndex, from: move.from, to: move.to, ...(move.promotion ? { promotion: move.promotion } : {}) });
    assert.equal(result.fen, move.fenAfter, `Replay diverged at ${move.ply}`);
  }
  const botIds = new Set(record.game.participants.filter(p => p.isBot).map(p => p.userId));
  const botDrops = moves.filter(m => m.dropPiece && botIds.has(m.userId)).length;
  assert(botDrops > 0, 'Real bots must use pocket drops during the match');
  assert(movesByHuman > 0); assert(reconnected, 'Reconnect path must be exercised');
  const originalSeats = latest.participants.map(p => [p.userId, p.team, p.boardIndex, p.color, p.isBot ? p.botLevel : null]);
  const rematch = await api(`/api/games/${gameId}/rematch`, {});
  const next = await api(`/api/lobbies/${rematch.lobbyId}`);
  assert.equal(next.lobby.mode, 'bughouse'); assert.equal(next.lobby.players.filter(p => p.isBot).length, 3);
  assert.equal(next.lobby.autoCountdown, 10);
  await ack('lobby:join', rematch.lobbyId);
  const nextGame = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Rematch did not auto-start')), 15_000);
    socket.once('lobby:started', ({ gameId: nextId }) => { clearTimeout(timer); resolve(nextId); });
  });
  const nextState = (await api(`/api/games/${nextGame}/state`)).state;
  assert.deepEqual(nextState.timeControl, { kind: 'none', baseMin: 0, incSec: 0 });
  assert.deepEqual(nextState.participants.map(p => [p.userId, p.team, p.boardIndex, p.color, p.isBot ? p.botLevel : null]), originalSeats);
  socket.emit('game:resign', nextGame);
  assert(pacedWaitTested, 'The human thinking pause must be exercised');
  console.log(JSON.stringify({ gameId, result: record.game.result, reason: record.game.reason, halfmoves: moves.length, botDrops, movesByHuman, reconnected, pacedWaitTested, rematch: rematch.lobbyId, nextGame, replay: 'all FENs match' }));
} finally { socket?.disconnect(); fairyPool.quit(); }
