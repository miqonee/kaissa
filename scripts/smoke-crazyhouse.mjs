// Run only against a disposable localhost server/database. Uses real server
// bots, human-seat AI assistance, archived replay, reconnection and rematch.
import assert from 'node:assert/strict';
import { io } from 'socket.io-client';
import { CrazyhouseGame } from 'shared/crazyhouse';
import { isDrop } from 'shared/bughouse';
import { chooseCrazyhouseMove } from '../server/dist/ai/crazyhouse.js';
import { fairyPool } from '../server/dist/ai/fairyStockfish.js';
const base = new URL(process.env.KAISSA_TEST_URL || 'http://127.0.0.1:4000');
assert(['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname), 'Use a disposable localhost server');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  for (const mode of ['crazyhouse', 'crazyhouse-team']) {
    let cookie = '';
    const api = async (path, body) => {
      const res = await fetch(new URL(path, base), { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      if (res.headers.get('set-cookie')) cookie = res.headers.get('set-cookie').split(';')[0];
      const data = await res.json(); assert(res.ok, JSON.stringify(data)); return data;
    };
    const { user } = await api('/api/auth/register', { username: `qa_crazy_${Date.now().toString(36)}`, password: 'local-crazyhouse-test-2026' });
    const socket = io(base.origin, { transports: ['websocket'], extraHeaders: { Cookie: cookie }, reconnection: false });
    const connect = () => new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
    const ack = async (event, ...args) => { const result = await socket.timeout(10_000).emitWithAck(event, ...args); assert(result.ok, result.error); return result.data; };
    let latest;
    let gameId;
    try {
      await connect();
      socket.on('game:state', state => { if (state.participants.some(p => p.userId === user.id)) latest = state; });
      socket.on('game:end', data => { if (latest?.gameId === data.gameId) latest = { ...latest, status: 'finished', ...data }; });
      const { lobbies } = await api('/api/lobbies');
      const quick = lobbies.find(l => l.isAuto && l.mode === 'team'); assert(quick);
      await ack('lobby:join', quick.id); await ack('lobby:set-mode', mode);
      const switched = (await api(`/api/lobbies/${quick.id}`)).lobby;
      assert.equal(switched.mode, mode); assert.equal(switched.players.length, mode === 'crazyhouse' ? 2 : 4); assert.equal(switched.timeControl.kind, 'none');
      ({ gameId } = await ack('lobby:start'));
      latest = (await api(`/api/games/${gameId}/state`)).state;
      assert.equal(latest.fens.length, 1); assert.equal(latest.rulesVersion, 2);
      const seats = latest.participants.map(p => [p.userId, p.team, p.moveSlot, p.isBot ? p.botLevel : null]);
      const deadline = Date.now() + 220_000;
      let lastPrinted = 0; let reconnected = false;
      while (latest.status === 'active' && latest.moveNumber < 140 && Date.now() < deadline) {
        if (latest.moveNumber >= lastPrinted + 12) { console.log(`${mode} #${gameId}: ${latest.moveNumber} halfmoves`); lastPrinted = latest.moveNumber; }
        if (!reconnected && latest.moveNumber >= 12) {
          socket.disconnect(); await sleep(200); const connected = connect(); socket.connect(); await connected;
          socket.emit('game:watch', gameId); latest = (await api(`/api/games/${gameId}/state`)).state; reconnected = true;
        }
        if (latest.status === 'active' && latest.turnUserIds[0] === user.id) {
          const record = await api(`/api/games/${gameId}`);
          const engine = new CrazyhouseGame(mode === 'crazyhouse-team');
          for (const m of record.moves.slice().sort((a, b) => a.ply - b.ply)) engine.apply(m.dropPiece ? { board: 0, piece: m.dropPiece, to: m.to } : { board: 0, from: m.from, to: m.to, ...(m.promotion ? { promotion: m.promotion } : {}) });
          assert.equal(engine.fen(0), latest.fens[0]);
          const move = await chooseCrazyhouseMove(engine.snapshot(), 2300);
          if (!move) { latest = (await api(`/api/games/${gameId}/state`)).state; assert.notEqual(latest.status, 'active', 'No legal move must finish the game'); continue; }
          await ack('game:move', { gameId, boardIndex: 0, from: isDrop(move) ? '-' : move.from, to: move.to, ...(isDrop(move) ? { dropPiece: move.piece } : { promotion: move.promotion }) });
        }
        await sleep(70);
      }
      if (latest.status === 'active') { socket.emit('game:resign', gameId); for (let i = 0; i < 100 && latest.status === 'active'; i++) await sleep(50); }
      assert.notEqual(latest.status, 'active');
      const record = await api(`/api/games/${gameId}`); const moves = record.moves.slice().sort((a, b) => a.ply - b.ply);
      assert.deepEqual(moves.map(m => m.ply), moves.map((_, i) => i + 1));
      const replay = new CrazyhouseGame(mode === 'crazyhouse-team');
      for (const m of moves) { const result = replay.apply(m.dropPiece ? { board: 0, piece: m.dropPiece, to: m.to } : { board: 0, from: m.from, to: m.to, ...(m.promotion ? { promotion: m.promotion } : {}) }); assert.equal(result.fen, m.fenAfter); }
      const botIds = new Set(record.game.participants.filter(p => p.isBot).map(p => p.userId));
      const botDrops = moves.filter(m => m.dropPiece && botIds.has(m.userId)).length; assert(botDrops > 0, 'Real bots must use their captured reserves'); assert(reconnected);
      const rematch = await api(`/api/games/${gameId}/rematch`, {}); const nextLobby = (await api(`/api/lobbies/${rematch.lobbyId}`)).lobby;
      assert.equal(nextLobby.mode, mode); assert.equal(nextLobby.players.length, seats.length); assert.equal(nextLobby.autoCountdown, 10);
      await ack('lobby:join', rematch.lobbyId);
      const nextId = await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('Rematch did not start')), 15_000); socket.once('lobby:started', data => { clearTimeout(timer); resolve(data.gameId); }); });
      const nextState = (await api(`/api/games/${nextId}/state`)).state;
      assert.deepEqual(nextState.participants.map(p => [p.userId, p.team, p.moveSlot, p.isBot ? p.botLevel : null]), seats);
      socket.emit('game:resign', nextId);
      console.log(JSON.stringify({ mode, gameId, halfmoves: moves.length, botDrops, result: record.game.result, reason: record.game.reason, reconnected, replay: 'all FENs match', rematchGame: nextId }));
    } finally { if (latest?.status === 'active') socket.emit('game:resign', gameId); socket.disconnect(); }
  }
} finally { fairyPool.quit(); }
