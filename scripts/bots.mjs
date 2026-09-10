// scripts/bots.mjs
// Скрипт 3 шаблонных ботов для тестирования премува в Каиссе.
// Запуск: node scripts/bots.mjs [КОД_СТОЛА] [--min-delay 5] [--max-delay 10]
// Режим только team: боты для багхауса отключены.

import { io } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import { Chess } from 'chess.js';

const SERVER_URL = process.env.KAISSA_URL || 'http://localhost:8080';
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-to-a-long-random-string';

const args = process.argv.slice(2);
let targetCode = null;
const mode = 'team';
let minDelaySec = 5;
let maxDelaySec = 10;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--mode' && args[i + 1]) {
    const requested = args[++i];
    if (requested === 'bughouse') {
      console.error('Боты для багхауса отключены — только режим team.');
      process.exit(1);
    }
  } else if (args[i] === '--min-delay' && args[i + 1]) {
    minDelaySec = Number(args[++i]);
  } else if (args[i] === '--max-delay' && args[i + 1]) {
    maxDelaySec = Number(args[++i]);
  } else if (!args[i].startsWith('-')) {
    targetCode = args[i].trim().toUpperCase();
  }
}

const BOTS = [
  { username: 'bot_dummy1', id: 16 },
  { username: 'bot_dummy2', id: 17 },
  { username: 'bot_dummy3', id: 18 },
];

function makeToken(uid, username) {
  return jwt.sign({ uid, username }, JWT_SECRET, { expiresIn: 86400 });
}

// Шаблонные дебютные ходы
const BOOK_MOVES = new Set([
  'e2e4', 'e7e5', 'd2d4', 'd7d5', 'g1f3', 'b8c6', 'f1c4', 'f8c5',
  'b1c3', 'g8f6', 'e1g1', 'e8g8', 'c2c4', 'c7c6', 'd2d3', 'd7d6',
  'c1e3', 'c8e6', 'd1e2', 'd8e7', 'f1e1', 'f8e8', 'a2a3', 'a7a6'
]);

const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

function evaluateMove(c, m, ply) {
  let score = Math.random() * 4;
  if (ply < 8 && BOOK_MOVES.has(m.from + m.to)) score += 35;
  if (m.captured) {
    const val = PIECE_VALUES[m.captured] || 1;
    score += 20 + val * 3;
  }
  if (m.san && m.san.includes('+')) score += 10;
  if (m.san === 'O-O' || m.san === 'O-O-O') score += 18;
  if (['e4', 'd4', 'e5', 'd5'].includes(m.to)) score += 6;
  if (['n', 'b'].includes(m.piece) && ['1', '8'].includes(m.from[1])) score += 8;
  return score;
}

function selectMove(fen, ply = 0) {
  try {
    const c = new Chess(fen);
    const moves = c.moves({ verbose: true });
    if (!moves.length) return null;
    moves.sort((a, b) => evaluateMove(c, b, ply) - evaluateMove(c, a, ply));
    return moves[0];
  } catch (e) {
    console.error('Ошибка в selectMove:', e);
    return null;
  }
}

let activeGame = null;
const moveTimers = new Map();
let isStarting = false;

function scheduleMove(bot, gameId, boardIndex) {
  const timerKey = `${gameId}_${bot.id}_${boardIndex}`;
  if (moveTimers.has(timerKey)) return;

  const delayMs = Math.floor((minDelaySec + Math.random() * (maxDelaySec - minDelaySec)) * 1000);
  const delaySec = (delayMs / 1000).toFixed(1);
  console.log(`⏱  [${bot.username}] Мой ход на доске ${boardIndex}. Думаю ${delaySec}с...`);

  const timer = setTimeout(() => {
    moveTimers.delete(timerKey);
    executeMove(bot, gameId, boardIndex);
  }, delayMs);

  moveTimers.set(timerKey, timer);
}

function executeMove(bot, gameId, boardIndex) {
  if (!activeGame || activeGame.gameId !== gameId || activeGame.status !== 'active') return;
  const currentMover = activeGame.turnUserIds[boardIndex];
  if (currentMover !== bot.id) return;

  const fen = activeGame.fens[boardIndex];
  const chosen = selectMove(fen, activeGame.moveNumber || 0);
  if (!chosen) {
    console.log(`[${bot.username}] Нет доступных ходов`);
    return;
  }

  const payload = {
    gameId,
    boardIndex,
    from: chosen.from,
    to: chosen.to,
    promotion: chosen.promotion || (chosen.flags?.includes('p') ? 'q' : undefined),
  };

  bot.socket.emit('game:move', payload, (ack) => {
    if (ack?.ok) {
      console.log(`♟️  [${bot.username}] Ход: ${chosen.san} (${chosen.from}-${chosen.to})`);
    } else {
      console.error(`❌ [${bot.username}] Ошибка хода:`, ack?.error);
    }
  });
}

function handleGameState(state) {
  const wasNewGame = !activeGame || activeGame.gameId !== state.gameId;
  activeGame = state;

  if (wasNewGame && state.status === 'active') {
    console.log(`\n======================================================`);
    console.log(`🎮 Партия #${state.gameId} активна!`);
    const whitePlayers = state.participants.filter((p) => p.color === 'w').map((p) => p.username).join(', ');
    const blackPlayers = state.participants.filter((p) => p.color === 'b').map((p) => p.username).join(', ');
    console.log(`⚪ Белые: ${whitePlayers}`);
    console.log(`⚫ Чёрные: ${blackPlayers}`);
    console.log(`======================================================\n`);
  }

  if (state.status === 'finished' || state.status === 'abandoned') {
    console.log(`\n🏁 Партия #${state.gameId} завершена: результат ${state.result} (${state.reason || 'ок'})`);
    for (const [, t] of moveTimers.entries()) clearTimeout(t);
    moveTimers.clear();
    isStarting = false;
    return;
  }

  if (state.status !== 'active') return;

  const boardsCount = state.mode === 'bughouse' ? 2 : 1;
  for (let b = 0; b < boardsCount; b++) {
    const moverUid = state.turnUserIds[b];
    const bot = BOTS.find((x) => x.id === moverUid);
    if (bot) {
      scheduleMove(bot, state.gameId, b);
    } else {
      const human = state.participants.find((p) => p.userId === moverUid);
      if (human) {
        console.log(`👉 Ход игрока: ${human.username} (можно делать премув)`);
      }
    }
  }
}

async function start() {
  console.log('🤖 Подключение 3 ботов к ' + SERVER_URL + '...');

  for (const b of BOTS) {
    const token = makeToken(b.id, b.username);
    b.token = token;
    b.socket = io(SERVER_URL, {
      extraHeaders: { Cookie: `kaissa_token=${token}` },
      transports: ['websocket', 'polling'],
    });

    await new Promise((resolve) => {
      b.socket.on('connect', () => {
        b.socket.emit('live:subscribe');
        resolve();
      });
    });

    b.socket.on('game:state', (st) => handleGameState(st));
    b.socket.on('game:move', (mv) => {
      if (!BOTS.some((x) => x.id === mv.userId)) {
        console.log(`👤 Ход игрока: ${mv.from}-${mv.to}`);
      }
      b.socket.emit('game:watch', mv.gameId);
    });
    b.socket.on('lobby:started', ({ gameId }) => {
      b.socket.emit('game:watch', gameId);
    });
  }

  console.log('✅ Все 3 бота подключены.');

  const hostBot = BOTS[0];
  let lobbyCode = targetCode;
  let lobbyId = null;

  if (!lobbyCode) {
    const res = await fetch(`${SERVER_URL}/api/lobbies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `kaissa_token=${hostBot.token}`,
      },
      body: JSON.stringify({
        name: 'Тест премува (3 бота)',
        mode,
        timeControl: { kind: 'none', baseMin: 0, incSec: 0 },
        private: false,
      }),
    }).then((r) => r.json());

    if (!res.lobby) {
      console.error('Не удалось создать лобби:', res);
      process.exit(1);
    }

    lobbyId = res.lobby.id;
    lobbyCode = res.code;
  }

  console.log('\n======================================================');
  console.log(`🎯 СТОЛ ДЛЯ ТЕСТИРОВАНИЯ ПРЕМУВА ГОТОВ!`);
  console.log(`📌 Код стола:  ${lobbyCode}`);
  console.log(`🔗 Ссылка:      ${SERVER_URL}/lobby/${lobbyId || lobbyCode}`);
  console.log(`⏱ Задержка ботов: ${minDelaySec}-${maxDelaySec} секунд`);
  console.log('======================================================\n');

  // Подключаем всех ботов к лобби
  for (const b of BOTS) {
    await new Promise((resolve) => {
      b.socket.emit('lobby:join', lobbyCode, (ack) => {
        if (!ack.ok) console.error(`[${b.username}] Ошибка входа в лобби:`, ack.error);
        b.socket.emit('lobby:ready', true);
        resolve();
      });
    });
  }

  // Следим за лобби
  hostBot.socket.on('lobby:state', (lobby) => {
    const playersCount = lobby.players.length;
    const readyCount = lobby.players.filter((p) => p.ready).length;
    console.log(`[Лобби ${lobby.code}] Игроков: ${playersCount}/4, Готовы: ${readyCount}/4 (${lobby.players.map((p) => p.username + (p.ready ? '✓' : '…')).join(', ')})`);

    if (playersCount === 4 && readyCount === 4 && !lobby.started && !isStarting) {
      isStarting = true;
      console.log('🚀 Все игроки готовы! Старт партии...');
      hostBot.socket.emit('lobby:start', (ack) => {
        if (!ack.ok) {
          isStarting = false;
          console.error('Ошибка старта лобби:', ack.error);
        }
      });
    }
  });

  console.log('Ожидание подключения 4-го игрока...');
  console.log(`1. Откройте в браузере: ${SERVER_URL}/lobby/${lobbyId || lobbyCode}`);
  console.log(`   (или перейдите на ${SERVER_URL} и выберите стол «Тест премува»)`);
  console.log('2. Если не авторизованы, можно войти как: player1 / password123');
  console.log('3. Нажмите кнопку «Готов» — партия сразу начнется!\n');
}

start().catch((err) => {
  console.error('Фатальная ошибка:', err);
  process.exit(1);
});
