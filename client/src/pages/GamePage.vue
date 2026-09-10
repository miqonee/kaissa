<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Chess, type Square } from 'chess.js';
import type { ChatMessage, GameParticipantInfo, GameState, PieceType } from 'shared';
import { detectOpening, getBotPersonality, getBotTooltip, timeControlLabel } from 'shared';
import { getSocket, onSocketResync } from '../api/socket';
import { useAuthStore } from '../stores/auth';
import { api } from '../api/rest';
import { openLichessAnalysis } from '../api/lichess';
import { analyzePosition } from '../utils/analysis';
import {
  playMoveSound,
  playCaptureSound,
  playCheckSound,
  playCastleSound,
  playDropSound,
  playQueenLossSound,
  playGameEndSound,
} from '../audio/sounds';
import ChessBoard from '../components/ChessBoard.vue';
import PocketBar from '../components/PocketBar.vue';
import AppIcon from '../components/AppIcon.vue';
import GameReplayModal from '../components/GameReplayModal.vue';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const socket = getSocket();
const gameId = Number(route.params.id);

const state = ref<GameState | null>(null);
const error = ref('');
const chat = ref<ChatMessage[]>([]);
const chatText = ref('');
const chatBox = ref<HTMLElement | null>(null);

const movesSanHistory = ref<string[]>([]);
const isChatOpen = ref(false);
const unreadChatCount = ref(0);

function toggleChat(): void {
  isChatOpen.value = !isChatOpen.value;
  if (isChatOpen.value) {
    unreadChatCount.value = 0;
    setTimeout(() => {
      if (chatBox.value) chatBox.value.scrollTop = chatBox.value.scrollHeight;
    }, 60);
  }
}

const recognizedOpening = computed(() => detectOpening(movesSanHistory.value));
const board0Fen = computed(() => fenOf(0));
const currentAnalysis = computed(() => analyzePosition(board0Fen.value));

const selectedDrop = ref<PieceType | null>(null);
const promoDialog = ref<{ board: 0 | 1; from: string; to: string } | null>(null);
const showResult = ref(false);
const showReplay = ref(false);
const disconnected = ref<{ userId: number; username: string }[]>([]);

const myId = computed(() => auth.user?.id ?? 0);
const isParticipant = computed(() => state.value?.participants.some((p) => p.userId === myId.value) ?? false);
const myParticipant = computed(() => state.value?.participants.find((p) => p.userId === myId.value) ?? null);

const myBoard = computed<0 | 1 | null>(() => {
  if (!state.value || state.value.mode !== 'bughouse') return null;
  return myParticipant.value?.boardIndex ?? null;
});

const boardsConfig = computed(() => {
  if (!state.value) return [];
  if (state.value.mode === 'bughouse') {
    return [{ index: 0 as const }, { index: 1 as const }];
  }
  return [{ index: 0 as const }];
});

function fenOf(b: number): string {
  return state.value?.fens[b] ?? '';
}

function orientationOf(b: 0 | 1): 'white' | 'black' {
  if (!state.value) return 'white';
  if (isParticipant.value && myParticipant.value?.boardIndex === b && myParticipant.value.color === 'b') {
    return 'black';
  }
  return 'white';
}

function myTurnOn(b: 0 | 1): boolean {
  if (!state.value || state.value.status !== 'active') return false;
  const idx = state.value.mode === 'bughouse' ? b : 0;
  const uid = state.value.turnUserIds[idx] ?? 0;
  return uid === myId.value;
}

function canPremoveOn(b: 0 | 1): boolean {
  if (!state.value || state.value.status !== 'active') return false;
  if (!isParticipant.value) return false;
  const p = myParticipant.value;
  if (!p) return false;
  if (state.value.mode === 'bughouse') {
    if (p.boardIndex !== b) return false;
    return !myTurnOn(b);
  }
  // team-режим: 1 доска
  if (myTurnOn(0)) return false;
  const currentTurnColor = state.value.turns[0];
  if (p.color === currentTurnColor) return false; // сейчас ход напарника
  // Сейчас ход соперников. Премув доступен, если наш слот следующий для нашей стороны
  const nextSlot = state.value.turnSlots ? state.value.turnSlots[p.color] : p.moveSlot;
  return p.moveSlot === nextSlot;
}

function movableOn(b: 0 | 1): 'white' | 'black' | null {
  if (!myTurnOn(b) && !canPremoveOn(b)) return null;
  return myParticipant.value?.color === 'w' ? 'white' : 'black';
}

const destsByBoard = computed<Record<number, Record<string, string[]>>>(() => {
  const out: Record<number, Record<string, string[]>> = { 0: {}, 1: {} };
  const st = state.value;
  if (!st || st.status !== 'active') return out;
  const boards = st.mode === 'bughouse' ? 2 : 1;
  for (let b = 0; b < boards; b++) {
    if (!myTurnOn(b as 0 | 1)) continue;
    try {
      const c = new Chess(st.fens[b]);
      for (const m of c.moves({ verbose: true })) {
        (out[b][m.from] ??= []).push(m.to);
      }
    } catch {}
  }
  return out;
});

const checkByBoard = computed<Record<number, string | null>>(() => {
  const out: Record<number, string | null> = { 0: null, 1: null };
  const st = state.value;
  if (!st) return out;
  const boards = st.mode === 'bughouse' ? 2 : 1;
  for (let b = 0; b < boards; b++) {
    try {
      const c = new Chess(st.fens[b]);
      if (!c.isCheck()) continue;
      const king = c.findPiece({ type: 'k', color: c.turn() });
      out[b] = king.length ? String(king[0]) : null;
    } catch {}
  }
  return out;
});

const lastMoves = ref<Record<number, (string | null)[]>>({ 0: [null, null], 1: [null, null] });

function lastMoveOf(b: 0 | 1): (string | null)[] | null {
  const lm = lastMoves.value[b];
  return lm && (lm[0] || lm[1]) ? lm : null;
}

function pocketOfBoard(b: 0 | 1, color: 'w' | 'b') {
  if (!state.value || !state.value.pockets) return null;
  const p = state.value.participants.find((x) => x.boardIndex === b && x.color === color);
  if (!p) return null;
  return state.value.pockets[state.value.participants.indexOf(p)] ?? null;
}

// ---------- Часы ----------
const localClocks = ref<[number, number][]>([]);
let ticker: number | undefined;
let lastTickAt = Date.now();

function rebuildLocalClocks(): void {
  if (!state.value) return;
  localClocks.value = state.value.clocks.map((c) => [c[0], c[1]] as [number, number]);
  lastTickAt = Date.now();
}

watch(() => state.value?.clocks, rebuildLocalClocks, { deep: true });

function tickClocks(): void {
  const now = Date.now();
  const elapsed = now - lastTickAt;
  lastTickAt = now;

  if (!state.value || state.value.status !== 'active') return;
  const st = state.value;
  st.clocks.forEach((_, b) => {
    const active = st.clocksActive[b];
    if (!active) return;
    const colorIdx = active === 'w' ? 0 : 1;
    const cur = localClocks.value[b]?.[colorIdx] ?? 0;
    if (localClocks.value[b]) localClocks.value[b][colorIdx] = Math.max(0, cur - elapsed);
  });
}

function clockMs(b: 0 | 1, color: 'w' | 'b'): number | null {
  if (!state.value || state.value.timeControl.kind === 'none') return null;
  const idx = state.value.mode === 'bughouse' ? b : 0;
  return localClocks.value[idx]?.[color === 'w' ? 0 : 1] ?? null;
}

function fmtClock(ms: number | null): string {
  if (ms === null) return '—';
  const s = Math.max(0, Math.ceil(ms / 100) / 10);
  if (ms < 20_000) return s.toFixed(1);
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

// ---------- Игроки для 2х2 (одна доска) и Багхауса ----------

/** Для 2x2: возвращает обе команды по 2 игрока */
const teamModeSides = computed(() => {
  if (!state.value || state.value.mode !== 'team') return null;
  const parts = state.value.participants;
  // Верхняя сторона (черные по умолчанию или соперники)
  const topColor: 'w' | 'b' = orientationOf(0) === 'white' ? 'b' : 'w';
  const bottomColor: 'w' | 'b' = topColor === 'w' ? 'b' : 'w';

  const getSide = (color: 'w' | 'b') => {
    return parts
      .filter((p) => p.color === color)
      .sort((a, b) => a.moveSlot - b.moveSlot);
  };

  return {
    top: { color: topColor, players: getSide(topColor) },
    bottom: { color: bottomColor, players: getSide(bottomColor) },
  };
});

function isPlayerTurn(uid: number): boolean {
  if (!state.value || state.value.status !== 'active') return false;
  return state.value.turnUserIds.includes(uid);
}

/** Роль участника относительно текущего пользователя: я / напарник / соперник */
type PlayerRole = 'me' | 'partner' | 'opponent';

function roleOf(p: GameParticipantInfo): PlayerRole {
  if (p.userId === myId.value) return 'me';
  if (myParticipant.value && p.team === myParticipant.value.team) return 'partner';
  return 'opponent';
}

const currentMover = computed(() => {
  if (!state.value || state.value.status !== 'active') return null;
  const uid = state.value.turnUserIds[0] ?? 0;
  return state.value.participants.find((p) => p.userId === uid) ?? null;
});

const orderedTurnParticipants = computed(() => {
  if (!state.value || state.value.mode !== 'team') return state.value?.participants ?? [];
  const parts = state.value.participants;
  const w0 = parts.find((p) => p.color === 'w' && p.moveSlot === 0);
  const b0 = parts.find((p) => p.color === 'b' && p.moveSlot === 0);
  const w1 = parts.find((p) => p.color === 'w' && p.moveSlot === 1);
  const b1 = parts.find((p) => p.color === 'b' && p.moveSlot === 1);
  const list = [w0, b0, w1, b1].filter(Boolean) as GameParticipantInfo[];
  return list.length === 4 ? list : parts;
});

// ---------- Действия ----------

function onMove(b: 0 | 1, payload: { from: string; to: string; premove?: boolean }): void {
  let c: Chess;
  try {
    c = new Chess(fenOf(b));
  } catch {
    return;
  }
  const piece = c.get(payload.from as Square);
  const movingColor = c.turn();
  const lastRank = movingColor === 'w' ? '8' : '1';
  if (piece && piece.type === 'p' && payload.to[1] === lastRank) {
    if (payload.premove) {
      sendMove(b, payload.from, payload.to, 'q');
      return;
    }
    promoDialog.value = { board: b, from: payload.from, to: payload.to };
    return;
  }
  sendMove(b, payload.from, payload.to);
}

function choosePromotion(t: PieceType): void {
  if (!promoDialog.value) return;
  const { board, from, to } = promoDialog.value;
  promoDialog.value = null;
  sendMove(board, from, to, t);
}

function sendMove(b: 0 | 1, from: string, to: string, promotion?: PieceType, dropPiece?: PieceType): void {
  socket.emit('game:move', { gameId, boardIndex: b, from, to, promotion, dropPiece }, (ack) => {
    if (!ack.ok) {
      error.value = ack.error ?? '';
      setTimeout(() => (error.value = ''), 2500);
      socket.emit('game:watch', gameId);
    }
  });
}

function onDrop(b: 0 | 1, payload: { piece: PieceType; to: string }): void {
  selectedDrop.value = null;
  sendMove(b, '-', payload.to, undefined, payload.piece);
}

function resign(): void {
  if (confirm('Сдаться всей командой?')) {
    socket.emit('game:resign', gameId);
  }
}

function sendChat(): void {
  const t = chatText.value.trim();
  if (!t) return;
  socket.emit('game:chat', gameId, t);
  chatText.value = '';
}

function scrollChat(): void {
  setTimeout(() => {
    if (chatBox.value) chatBox.value.scrollTop = chatBox.value.scrollHeight;
  }, 30);
}

// ---------- Lifecycle ----------

let offResync: (() => void) | null = null;
let watchRetryTimer: number | undefined;

function requestWatch(retries: number = 3): void {
  socket.emit('game:watch', gameId);
  if (retries > 0 && !state.value) {
    clearTimeout(watchRetryTimer);
    watchRetryTimer = window.setTimeout(() => {
      if (!state.value) requestWatch(retries - 1);
    }, 700);
  }
}

onMounted(() => {
  socket.on('game:state', (st) => {
    if (st.gameId !== gameId) return;
    clearTimeout(watchRetryTimer);
    state.value = st;
    if (st.moves && Array.isArray(st.moves)) {
      movesSanHistory.value = [...st.moves];
    }
    if (st.status !== 'active') showResult.value = true;
    rebuildLocalClocks();
  });

  socket.on('game:move', (mv) => {
    if (mv.gameId !== gameId) return;
    lastMoves.value = {
      ...lastMoves.value,
      [mv.boardIndex]: mv.dropPiece ? [mv.to, mv.to] : [mv.from, mv.to],
    };
    selectedDrop.value = null;

    // Звуки ходов и обновление истории SAN для дебютной базы
    if (mv.dropPiece) {
      playDropSound();
    } else {
      try {
        const prevFen = fenOf(mv.boardIndex);
        const c = new Chess(prevFen);
        const m = c.move({
          from: mv.from as Square,
          to: mv.to as Square,
          ...(mv.promotion ? { promotion: mv.promotion as 'q' } : {}),
        });
        if (mv.boardIndex === 0 && m?.san) {
          // Защита: не пушим одиночный ход как ход #1, если партия уже в разгаре
          if (movesSanHistory.value.length > 0 || prevFen.startsWith('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR')) {
            movesSanHistory.value.push(m.san);
          }
        }
        if (m.captured === 'q') {
          playQueenLossSound();
        } else if (c.isCheck()) {
          playCheckSound();
        } else if (m.san.includes('O-O')) {
          playCastleSound();
        } else if (m.captured) {
          playCaptureSound();
        } else {
          playMoveSound();
        }
      } catch {
        playMoveSound();
      }
    }
  });

  socket.on('game:end', (payload) => {
    if (payload.gameId !== gameId) return;
    if (state.value) {
      state.value.status = 'finished';
      state.value.result = payload.result;
      state.value.reason = payload.reason;
      state.value.participants = payload.participants;
      showResult.value = true;
    }
    const myTeam = myParticipant.value?.team;
    const won = myTeam ? (payload.result === '1-0' && myTeam === 1) || (payload.result === '0-1' && myTeam === 2) : true;
    playGameEndSound(won);
  });

  socket.on('game:chat', (msg) => {
    if (msg.gameId !== gameId) return;
    chat.value.push(msg);
    if (!isChatOpen.value && msg.userId !== myId.value) {
      unreadChatCount.value++;
    }
    scrollChat();
  });

  socket.on('game:players-left', (payload) => {
    if (payload.gameId !== gameId) return;
    disconnected.value = payload.left;
  });

  socket.on('game:rematch', (payload) => {
    if (payload.gameId !== gameId) return;
    router.push(`/lobby/${payload.lobbyId}`);
  });

  socket.on('game:next', (payload) => {
    if (!isParticipant.value) {
      router.push(`/game/${payload.nextGameId}`);
    }
  });

  // REST-запрос параллельно сокету для мгновенной загрузки стола
  api.get<{ state: GameState }>(`/api/games/${gameId}/state`).then((res) => {
    if (res.state) {
      if (!state.value) state.value = res.state;
      if (res.state.moves && Array.isArray(res.state.moves)) {
        if (movesSanHistory.value.length === 0 || res.state.moves.length >= movesSanHistory.value.length) {
          movesSanHistory.value = [...res.state.moves];
        }
      }
      if (res.state.status !== 'active') showResult.value = true;
      rebuildLocalClocks();
    }
  }).catch(() => {});

  requestWatch(3);
  offResync = onSocketResync(() => requestWatch(2));

  lastTickAt = Date.now();
  ticker = window.setInterval(tickClocks, 100);
});

onBeforeUnmount(() => {
  socket.emit('game:leave', gameId);
  clearTimeout(watchRetryTimer);
  offResync?.();
  offResync = null;
  socket.off('game:state');
  socket.off('game:move');
  socket.off('game:end');
  socket.off('game:chat');
  socket.off('game:players-left');
  socket.off('game:rematch');
  socket.off('game:next');
  clearInterval(ticker);
});

// ---------- Реванш и Анализ Lichess ----------

const rematchBusy = ref(false);
const lichessBusy = ref(false);

async function rematch(): Promise<void> {
  rematchBusy.value = true;
  try {
    const res = await api.post<{ lobbyId: string }>(`/api/games/${gameId}/rematch`, {});
    router.push(`/lobby/${res.lobbyId}`);
  } catch (e: any) {
    error.value = e.message || 'Ошибка создания реванша';
  } finally {
    rematchBusy.value = false;
  }
}

async function analyzeOnLichess(boardIdx: number = 0) {
  lichessBusy.value = true;
  try {
    await openLichessAnalysis(gameId, boardIdx);
  } finally {
    lichessBusy.value = false;
  }
}

const REASONS: Record<string, string> = {
  checkmate: 'Мат',
  resign: 'Сдача',
  timeout: 'Время вышло',
  stalemate: 'Пат',
  material: 'Недостаток материала',
  repetition: 'Троекратное повторение',
  fifty: 'Правило 50 ходов',
  abandoned: 'Партия брошена',
};

function resultHeadline(): string {
  if (!state.value || state.value.status === 'active') return '';
  const s = state.value;
  const reason = REASONS[s.reason ?? ''] ?? s.reason ?? '';
  if (s.status === 'abandoned') return `Партия брошена (${reason || 'выход игроков'})`;
  if (s.result === '*' || s.result === '1/2-1/2') return `Ничья (${reason || 'по правилам'})`;
  const winnerTeam = s.result === '1-0' ? 1 : (s.result === '0-1' ? 2 : null);
  if (!winnerTeam) return `Партия завершена (${reason})`;
  const winners = s.participants.filter((p) => p.team === winnerTeam).map((p) => p.username);
  const sideColor = winnerTeam === 1 ? 'Белые' : 'Чёрные';
  return `Победа (${sideColor}): ${winners.join(' / ')} (${reason})`;
}
</script>

<template>
  <div v-if="state" class="game-page" :class="state.mode">
    <!-- Верхняя информационная плашка -->
    <div class="game-topbar panel">
      <div class="game-title-group">
        <router-link to="/" class="back-link" title="К столам">
          <AppIcon name="arrow-left" :size="14" /> Столы
        </router-link>
        <h1>
          {{ state.mode === 'bughouse' ? 'Багхаус' : 'Матч 2×2 (одна доска)' }}
        </h1>
        <span class="badge mono">{{ timeControlLabel(state.timeControl) }}</span>
        <span v-if="state.status === 'active'" class="badge on">В игре</span>
        <span v-else class="badge">{{ state.result }}</span>
        <span v-if="!isParticipant" class="badge dim">Режим зрителя</span>
      </div>

      <div class="game-topbar-actions">
        <button v-if="state.status !== 'active'" class="small" @click="showReplay = true">
          <AppIcon name="play" :size="13" /> Смотреть партию
        </button>
        <button v-if="isParticipant && state.status === 'active'" class="danger small" @click="resign">
          Сдаться
        </button>
        <button v-if="state.status !== 'active'" class="small brass" @click="analyzeOnLichess(0)">
          <AppIcon name="external" :size="13" /> Анализ на Lichess
        </button>
      </div>
    </div>

    <!-- Основная сетка игры -->
    <div class="game-layout">
      <!-- Игровая зона (1 или 2 доски) -->
      <div class="boards-container" :class="{ 'two-boards': state.mode === 'bughouse' }">
        <!-- ================= РЕЖИМ 2х2 (ОДНА ДОСКА) ================= -->
        <div v-if="state.mode === 'team' && teamModeSides" class="team-board-wrapper">
          <!-- Верхняя команда (соперники) -->
          <div class="team-players-bar top">
            <!-- Слева: Игрок 1 (слот 1, начинает) -->
            <div class="team-slot left">
              <div
                v-if="teamModeSides.top.players[0]"
                class="member-pill compact"
                :class="[roleOf(teamModeSides.top.players[0]), { 'active-turn': isPlayerTurn(teamModeSides.top.players[0].userId) }]"
              >
                <span class="slot-num mono">1</span>
                <span class="member-name" :title="teamModeSides.top.players[0].isBot ? getBotTooltip(teamModeSides.top.players[0].username, teamModeSides.top.players[0].ratingBefore) : undefined">{{ teamModeSides.top.players[0].username }}</span>
                <span v-if="teamModeSides.top.players[0].isBot" class="bot-badge tiny" :title="getBotTooltip(teamModeSides.top.players[0].username, teamModeSides.top.players[0].ratingBefore)">
                  {{ getBotPersonality(teamModeSides.top.players[0].username)?.badge ? 'Бот · ' + getBotPersonality(teamModeSides.top.players[0].username)?.badge : 'Бот' }}
                </span>
                <span class="member-rating mono">({{ teamModeSides.top.players[0].ratingBefore }})</span>
                <span v-if="roleOf(teamModeSides.top.players[0]) === 'me'" class="member-role me">Вы</span>
                <span v-else-if="roleOf(teamModeSides.top.players[0]) === 'partner'" class="member-role partner">Напарник</span>
                <span v-if="isPlayerTurn(teamModeSides.top.players[0].userId)" class="turn-chip">
                  <span class="turn-dot"></span> Ходит
                </span>
              </div>
            </div>

            <!-- По центру: Таймер стороны -->
            <div class="clock-display mono center" :class="{ running: state.clocksActive[0] === teamModeSides.top.color }">
              {{ fmtClock(clockMs(0, teamModeSides.top.color)) }}
            </div>

            <!-- Справа: Игрок 2 (слот 2, ходит вторым) -->
            <div class="team-slot right">
              <div
                v-if="teamModeSides.top.players[1]"
                class="member-pill compact"
                :class="[roleOf(teamModeSides.top.players[1]), { 'active-turn': isPlayerTurn(teamModeSides.top.players[1].userId) }]"
              >
                <span class="slot-num mono">2</span>
                <span class="member-name" :title="teamModeSides.top.players[1].isBot ? getBotTooltip(teamModeSides.top.players[1].username, teamModeSides.top.players[1].ratingBefore) : undefined">{{ teamModeSides.top.players[1].username }}</span>
                <span v-if="teamModeSides.top.players[1].isBot" class="bot-badge tiny" :title="getBotTooltip(teamModeSides.top.players[1].username, teamModeSides.top.players[1].ratingBefore)">
                  {{ getBotPersonality(teamModeSides.top.players[1].username)?.badge ? 'Бот · ' + getBotPersonality(teamModeSides.top.players[1].username)?.badge : 'Бот' }}
                </span>
                <span class="member-rating mono">({{ teamModeSides.top.players[1].ratingBefore }})</span>
                <span v-if="roleOf(teamModeSides.top.players[1]) === 'me'" class="member-role me">Вы</span>
                <span v-else-if="roleOf(teamModeSides.top.players[1]) === 'partner'" class="member-role partner">Напарник</span>
                <span v-if="isPlayerTurn(teamModeSides.top.players[1].userId)" class="turn-chip">
                  <span class="turn-dot"></span> Ходит
                </span>
              </div>
            </div>
          </div>

          <!-- Сама доска -->
          <div class="board-frame">
            <ChessBoard
              :fen="fenOf(0)"
              :orientation="orientationOf(0)"
              :movable-color="movableOn(0)"
              :can-premove="canPremoveOn(0)"
              :dests="destsByBoard[0]"
              :check-square="checkByBoard[0]"
              :last-move="lastMoveOf(0)"
              :coordinates="true"
              @move="onMove(0, $event)"
              @premove-set="playMoveSound"
            />
          </div>

          <!-- Нижняя команда (моя сторона) -->
          <div class="team-players-bar bottom">
            <!-- Слева: Игрок 1 (слот 1, начинает) -->
            <div class="team-slot left">
              <div
                v-if="teamModeSides.bottom.players[0]"
                class="member-pill compact"
                :class="[roleOf(teamModeSides.bottom.players[0]), { 'active-turn': isPlayerTurn(teamModeSides.bottom.players[0].userId) }]"
              >
                <span class="slot-num mono">1</span>
                <span class="member-name" :title="teamModeSides.bottom.players[0].isBot ? getBotTooltip(teamModeSides.bottom.players[0].username, teamModeSides.bottom.players[0].ratingBefore) : undefined">{{ teamModeSides.bottom.players[0].username }}</span>
                <span v-if="teamModeSides.bottom.players[0].isBot" class="bot-badge tiny" :title="getBotTooltip(teamModeSides.bottom.players[0].username, teamModeSides.bottom.players[0].ratingBefore)">
                  {{ getBotPersonality(teamModeSides.bottom.players[0].username)?.badge ? 'Бот · ' + getBotPersonality(teamModeSides.bottom.players[0].username)?.badge : 'Бот' }}
                </span>
                <span class="member-rating mono">({{ teamModeSides.bottom.players[0].ratingBefore }})</span>
                <span v-if="roleOf(teamModeSides.bottom.players[0]) === 'me'" class="member-role me">Вы</span>
                <span v-else-if="roleOf(teamModeSides.bottom.players[0]) === 'partner'" class="member-role partner">Напарник</span>
                <span v-if="isPlayerTurn(teamModeSides.bottom.players[0].userId)" class="turn-chip">
                  <span class="turn-dot"></span> Ходит
                </span>
              </div>
            </div>

            <!-- По центру: Таймер стороны -->
            <div class="clock-display mono center" :class="{ running: state.clocksActive[0] === teamModeSides.bottom.color }">
              {{ fmtClock(clockMs(0, teamModeSides.bottom.color)) }}
            </div>

            <!-- Справа: Игрок 2 (слот 2, ходит вторым) -->
            <div class="team-slot right">
              <div
                v-if="teamModeSides.bottom.players[1]"
                class="member-pill compact"
                :class="[roleOf(teamModeSides.bottom.players[1]), { 'active-turn': isPlayerTurn(teamModeSides.bottom.players[1].userId) }]"
              >
                <span class="slot-num mono">2</span>
                <span class="member-name" :title="teamModeSides.bottom.players[1].isBot ? getBotTooltip(teamModeSides.bottom.players[1].username, teamModeSides.bottom.players[1].ratingBefore) : undefined">{{ teamModeSides.bottom.players[1].username }}</span>
                <span v-if="teamModeSides.bottom.players[1].isBot" class="bot-badge tiny" :title="getBotTooltip(teamModeSides.bottom.players[1].username, teamModeSides.bottom.players[1].ratingBefore)">
                  {{ getBotPersonality(teamModeSides.bottom.players[1].username)?.badge ? 'Бот · ' + getBotPersonality(teamModeSides.bottom.players[1].username)?.badge : 'Бот' }}
                </span>
                <span class="member-rating mono">({{ teamModeSides.bottom.players[1].ratingBefore }})</span>
                <span v-if="roleOf(teamModeSides.bottom.players[1]) === 'me'" class="member-role me">Вы</span>
                <span v-else-if="roleOf(teamModeSides.bottom.players[1]) === 'partner'" class="member-role partner">Напарник</span>
                <span v-if="isPlayerTurn(teamModeSides.bottom.players[1].userId)" class="turn-chip">
                  <span class="turn-dot"></span> Ходит
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- ================= РЕЖИМ БАГХАУС (ДВЕ ДОСКИ) ================= -->
        <div
          v-else
          v-for="bc in boardsConfig"
          :key="bc.index"
          class="bughouse-board-col"
          :class="{ 'my-board': isParticipant && myBoard === bc.index }"
        >
          <div class="board-top-info">
            <span class="board-number-badge mono">Доска {{ bc.index + 1 }}</span>
            <span v-if="isParticipant && myBoard === bc.index" class="badge on">Ваша доска</span>
          </div>

          <!-- Верхний карман соперника -->
          <PocketBar
            v-if="pocketOfBoard(bc.index, orientationOf(bc.index) === 'white' ? 'b' : 'w')"
            :pocket="pocketOfBoard(bc.index, orientationOf(bc.index) === 'white' ? 'b' : 'w')!"
            :color="orientationOf(bc.index) === 'white' ? 'b' : 'w'"
            :interactive="false"
            :selected="null"
          />

          <!-- Доска -->
          <div class="board-frame">
            <ChessBoard
              :fen="fenOf(bc.index)"
              :orientation="orientationOf(bc.index)"
              :movable-color="movableOn(bc.index)"
              :can-premove="canPremoveOn(bc.index)"
              :dests="destsByBoard[bc.index]"
              :check-square="checkByBoard[bc.index]"
              :last-move="lastMoveOf(bc.index)"
              :drop-piece="myTurnOn(bc.index) ? selectedDrop : null"
              :coordinates="true"
              @move="onMove(bc.index, $event)"
              @drop="onDrop(bc.index, $event)"
              @premove-set="playMoveSound"
            />
          </div>

          <!-- Нижний карман игрока (интерактивен, если мой ход) -->
          <PocketBar
            v-if="pocketOfBoard(bc.index, orientationOf(bc.index) === 'white' ? 'w' : 'b')"
            :pocket="pocketOfBoard(bc.index, orientationOf(bc.index) === 'white' ? 'w' : 'b')!"
            :color="orientationOf(bc.index) === 'white' ? 'w' : 'b'"
            :interactive="myTurnOn(bc.index)"
            :selected="selectedDrop"
            @select="selectedDrop = $event"
          />

          <!-- Часы игроков этой доски -->
          <div class="bughouse-clocks-bar">
            <div class="b-clock-side">
              <span class="dim">Белые:</span>
              <span class="mono" :class="{ 'clock-active': state.clocksActive[bc.index] === 'w' }">
                {{ fmtClock(clockMs(bc.index, 'w')) }}
              </span>
            </div>
            <div class="b-clock-side">
              <span class="dim">Черные:</span>
              <span class="mono" :class="{ 'clock-active': state.clocksActive[bc.index] === 'b' }">
                {{ fmtClock(clockMs(bc.index, 'b')) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Боковая панель: Чат + Статус -->
      <aside class="game-sidebar">
        <!-- Панель статуса / очереди -->
        <div class="panel queue-panel">
          <div class="panel-head">
            <h3>Очередь ходов</h3>
          </div>
          <div class="panel-body queue-body">
            <div v-if="state.mode === 'team'" class="queue-explain">
              <p class="dim small-hint">
                Чередование ходов: Белые → Черные → Белые → Черные
              </p>
              <div class="queue-list">
                <div
                  v-for="(p, idx) in orderedTurnParticipants"
                  :key="p.userId"
                  class="queue-item"
                  :class="[roleOf(p), { current: isPlayerTurn(p.userId) }]"
                >
                  <span class="queue-dot" :class="{ on: isPlayerTurn(p.userId) }"></span>
                  <span class="queue-order mono dim">{{ idx + 1 }}</span>
                  <span class="color-tag" :class="p.color">
                    {{ p.color === 'w' ? 'Белые' : 'Черные' }}
                  </span>
                  <span class="queue-name">{{ p.username }}</span>
                  <span v-if="roleOf(p) === 'me'" class="member-role me">Вы</span>
                  <span v-else-if="roleOf(p) === 'partner'" class="member-role partner">Напарник</span>
                  <span v-if="isPlayerTurn(p.userId)" class="turn-now-chip">ХОД</span>
                </div>
              </div>
            </div>

            <div v-else class="queue-bughouse-hint">
              <p class="small-hint dim">
                Обе доски играют одновременно. Кликните по фигуре в кармане и затем по пустой клетке для дропа.
              </p>
            </div>

            <p v-if="currentMover && state.mode === 'team'" class="small-hint dim">
              Ход: <strong>{{ currentMover.username }}</strong>
            </p>

            <p v-if="disconnected.length" class="warn-text">
              Отключились: {{ disconnected.map((d) => d.username).join(', ') }}
            </p>
            <p v-if="error" class="error-text">{{ error }}</p>
          </div>
        </div>

        <!-- Панель дебюта и анализа -->
        <div class="panel opening-panel">
          <div class="panel-head">
            <div class="opening-head-title">
              <AppIcon name="book-open" :size="15" />
              <h3>Дебют и анализ</h3>
            </div>
            <div class="opening-badges">
              <span v-if="state.mode === 'team'" class="eco-badge mono">{{ recognizedOpening.eco }}</span>
              <span
                v-if="state.mode === 'team'"
                class="stage-badge"
                :class="recognizedOpening.stage"
              >
                {{ recognizedOpening.stageLabelRu }}
              </span>
              <span
                v-if="state.mode === 'team'"
                class="eval-pill mono"
                :class="{
                  'eval-w': currentAnalysis.scoreCp > 35,
                  'eval-b': currentAnalysis.scoreCp < -35,
                  'eval-eq': Math.abs(currentAnalysis.scoreCp) <= 35
                }"
                :title="`Оценка: ${currentAnalysis.evalText} (${currentAnalysis.verdictRu})`"
              >
                {{ currentAnalysis.evalText }}
              </span>
            </div>
          </div>

          <div class="panel-body opening-body">
            <template v-if="state.mode === 'team'">
              <!-- Оценка позиции и шкала перевеса -->
              <div class="eval-section">
                <div class="eval-bar-track" :title="`Шансы сторон: белые ${currentAnalysis.evalPercent}% / чёрные ${100 - currentAnalysis.evalPercent}%`">
                  <div class="eval-bar-fill white" :style="{ width: `${currentAnalysis.evalPercent}%` }"></div>
                  <div class="eval-bar-fill black" :style="{ width: `${100 - currentAnalysis.evalPercent}%` }"></div>
                </div>
                <div class="eval-meta-row">
                  <span class="eval-verdict-text dim">{{ currentAnalysis.verdictRu }}</span>
                  <span
                    v-if="currentAnalysis.materialDiff !== 0"
                    class="material-badge mono"
                    :class="{ 'mat-w': currentAnalysis.materialDiff > 0, 'mat-b': currentAnalysis.materialDiff < 0 }"
                  >
                    {{ currentAnalysis.materialDiff > 0 ? `Белые +${currentAnalysis.materialDiff}` : `Чёрные +${Math.abs(currentAnalysis.materialDiff)}` }}
                  </span>
                </div>
              </div>

              <!-- Название дебюта и варианта -->
              <div class="opening-name-block">
                <h4 class="opening-title">{{ recognizedOpening.nameRu }}</h4>
                <p v-if="recognizedOpening.variationRu" class="opening-variation">
                  {{ recognizedOpening.variationRu }}
                </p>
                <span class="opening-name-en dim mono">{{ recognizedOpening.nameEn }}</span>
              </div>

              <!-- Теоретические продолжения (вариации из текущей позиции) -->
              <div v-if="recognizedOpening.continuations && recognizedOpening.continuations.length > 0" class="continuations-block">
                <span class="dim small-label">Варианты теории:</span>
                <div class="continuation-chips">
                  <span
                    v-for="c in recognizedOpening.continuations"
                    :key="c.moveSan"
                    class="cont-chip"
                    :title="c.variationRu ? `${c.nameRu}: ${c.variationRu}` : c.nameRu"
                  >
                    <strong class="mono cont-move">{{ c.moveSan }}</strong>
                    <span v-if="c.variationRu" class="cont-var dim">{{ c.variationRu }}</span>
                  </span>
                </div>
              </div>

              <!-- Сыгранные ходы партии (полная нотация) -->
              <div v-if="recognizedOpening.playedMovesSan && recognizedOpening.playedMovesSan !== '—'" class="opening-moves-row">
                <div class="moves-header-row">
                  <span class="dim small-label">Ходы партии:</span>
                  <span class="dim tiny mono">{{ movesSanHistory.length }} полуходов</span>
                </div>
                <div class="moves-history-box mono">
                  {{ recognizedOpening.playedMovesSan }}
                </div>
              </div>

              <!-- Стратегический план стороны -->
              <div class="opening-plan-box">
                <span class="dim small-label">Стратегический план:</span>
                <p class="plan-text">{{ recognizedOpening.planRu }}</p>
              </div>
            </template>

            <template v-else>
              <div class="opening-name-block">
                <h4 class="opening-title">Багхаус (Шведские шахматы)</h4>
                <p class="opening-variation">Две параллельные доски с дропами</p>
              </div>
              <div class="opening-plan-box">
                <span class="dim small-label">Правила и тактика:</span>
                <p class="plan-text">
                  Сбитая на одной доске фигура немедленно передается в карман напарника. Координируйте атаки и требуйте нужные фигуры для мата!
                </p>
              </div>
            </template>
          </div>
        </div>

        <!-- Выдвижная шторка чата (высотой 40px, вровень с team-players-bar bottom, раскрывается вверх) -->
        <div class="chat-drawer-wrapper">
          <div class="chat-drawer-container" :class="{ 'is-expanded': isChatOpen }">
            <div
              class="chat-bar-toggle"
              :class="{ 'has-unread': unreadChatCount > 0 && !isChatOpen }"
              @click="toggleChat"
              title="Открыть / свернуть чат"
            >
              <div class="chat-toggle-left">
                <AppIcon name="message-square" :size="15" />
                <span class="chat-toggle-label">Чат матча</span>
                <span v-if="unreadChatCount > 0 && !isChatOpen" class="unread-pill">
                  +{{ unreadChatCount }}
                </span>
              </div>
              <div class="chat-toggle-right">
                <span class="chat-msg-count dim mono">{{ chat.length }}</span>
                <AppIcon :name="isChatOpen ? 'chevron-down' : 'chevron-up'" :size="15" />
              </div>
            </div>

            <!-- Раскрывающееся тело чата (выдвигается вверх над панелью дебютов) -->
            <div v-show="isChatOpen" class="chat-expanded-content">
              <div ref="chatBox" class="chat-log">
                <div v-for="m in chat" :key="m.id" class="chat-msg" :class="{ system: m.system }">
                  <template v-if="m.system">
                    <span class="dim system-msg">{{ m.text }}</span>
                  </template>
                  <template v-else>
                    <span class="chat-user">{{ m.username }}:</span>
                    <span class="chat-text">{{ m.text }}</span>
                  </template>
                </div>
              </div>
              <form class="chat-input-row" @submit.prevent="sendChat">
                <input v-model="chatText" placeholder="Сообщение всем…" maxlength="300" />
                <button type="submit" class="primary icon-only" aria-label="Отправить">
                  <AppIcon name="arrow-right" :size="15" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </aside>
    </div>

    <!-- Диалог промоушена пешки -->
    <div v-if="promoDialog" class="modal-backdrop" @click.self="promoDialog = null">
      <div class="modal promo-modal">
        <h3>Превращение пешки</h3>
        <p class="dim">Выберите фигуру:</p>
        <div class="promo-pieces-grid">
          <button
            v-for="t in ['q', 'r', 'b', 'n']"
            :key="t"
            class="promo-piece-btn"
            @click="choosePromotion(t as PieceType)"
          >
            <img
              :src="`/pieces/cburnett/${myParticipant?.color ?? 'w'}${t.toUpperCase()}.svg`"
              :alt="t"
            />
          </button>
        </div>
      </div>
    </div>

    <!-- Модальное окно завершения партии -->
    <div v-if="showResult && state.status !== 'active'" class="modal-backdrop" @click.self="showResult = false">
      <div class="modal result-modal">
        <div class="modal-head">
          <h2>Партия завершена</h2>
          <button class="modal-close" aria-label="Закрыть" @click="showResult = false">
            <AppIcon name="close" :size="18" />
          </button>
        </div>

        <div class="modal-body">
          <div class="headline-box">
            <h3>{{ resultHeadline() }}</h3>
            <p v-if="!isParticipant" class="dim next-game-hint">Следующая автопартия начнётся автоматически…</p>
          </div>

          <!-- Таблица изменений рейтинга -->
          <table class="club result-table">
            <thead>
              <tr>
                <th>Игрок</th>
                <th>Команда</th>
                <th class="num">Было</th>
                <th class="num">±</th>
                <th class="num">Итог</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in state.participants" :key="p.userId">
                <td>
                  <strong class="player-name" :title="p.isBot ? getBotTooltip(p.username, p.ratingBefore) : undefined">{{ p.username }}</strong>
                  <span v-if="p.isBot" class="bot-badge tiny" style="margin-left: 6px;" :title="getBotTooltip(p.username, p.ratingBefore)">
                    {{ getBotPersonality(p.username)?.badge ? 'Бот · ' + getBotPersonality(p.username)?.badge : 'Бот' }}
                  </span>
                </td>
                <td class="dim">Команда {{ p.team }} ({{ p.color === 'w' ? 'белые' : 'черные' }})</td>
                <td class="mono dim num">{{ p.ratingBefore }}</td>
                <td class="num">
                  <span
                    v-if="p.ratingAfter !== null && (p.ratingAfter - p.ratingBefore) !== 0"
                    class="rating-delta"
                    :class="{ plus: p.ratingAfter > p.ratingBefore, minus: p.ratingAfter < p.ratingBefore }"
                  >
                    {{ p.ratingAfter - p.ratingBefore > 0 ? '+' : '' }}{{ p.ratingAfter - p.ratingBefore }}
                  </span>
                  <span v-else class="rating-delta mono dim">±0</span>
                </td>
                <td class="mono num" style="font-weight: 700;">{{ p.ratingAfter ?? p.ratingBefore }}</td>
              </tr>
            </tbody>
          </table>

          <!-- Блок анализа партии -->
          <div class="analysis-box">
            <div class="analysis-text">
              <h4>Анализ партии</h4>
              <p class="dim small-hint">
                Пересмотрите партию в плеере, скачайте PGN или откройте разбор в движке на Lichess.
              </p>
            </div>
            <div class="analysis-buttons">
              <button class="primary" @click="showReplay = true">
                <AppIcon name="play" :size="15" /> Смотреть партию
              </button>
              <a :href="`/api/games/${gameId}/pgn?download=1`" class="button" download>
                <AppIcon name="download" :size="15" /> Скачать PGN
              </a>
              <button
                class="brass"
                :disabled="lichessBusy"
                @click="analyzeOnLichess(0)"
              >
                <AppIcon name="external" :size="14" />
                {{ lichessBusy ? 'Открываем…' : (state.mode === 'bughouse' ? 'Lichess · доска 1' : 'Анализ на Lichess') }}
              </button>
              <button
                v-if="state.mode === 'bughouse'"
                class="small ghost"
                @click="analyzeOnLichess(1)"
              >
                <AppIcon name="external" :size="13" /> Lichess · доска 2
              </button>
            </div>
          </div>
        </div>

        <div class="modal-foot">
          <button v-if="isParticipant" class="primary big" :disabled="rematchBusy" @click="rematch">
            <AppIcon name="rematch" :size="16" />
            {{ rematchBusy ? 'Создаём…' : 'Реванш' }}
          </button>
          <router-link to="/" class="button ghost">
            В лобби
          </router-link>
        </div>
      </div>
    </div>

    <!-- Плеер партии поверх -->
    <GameReplayModal
      v-if="showReplay"
      :game-id="gameId"
      :title="`Партия #${gameId}`"
      @close="showReplay = false"
    />
  </div>

  <div v-else class="game-loading-wrap">
    <div class="panel game-loading-panel">
      <h2>Подключение к столу #{{ gameId }}…</h2>
      <p class="hint">Синхронизация состояния доски с сервером</p>
      <button class="brass small" @click="requestWatch(3)">
        <AppIcon name="refresh" :size="14" /> Обновить
      </button>
    </div>
  </div>
</template>

<style scoped>
.game-loading-wrap {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 50vh;
}

.game-loading-panel {
  text-align: center;
  padding: 32px 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.game-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: -12px;
}

.game-page.team {
  max-width: 1080px;
  margin: -12px auto 0;
  width: 100%;
}

:global(main.page:has(.game-page.bughouse)) {
  max-width: 1760px;
  padding-left: 18px;
  padding-right: 18px;
}

.game-page.bughouse {
  max-width: 1720px;
  margin: -12px auto 0;
  width: 100%;
}

.game-page.bughouse .game-layout {
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 20px;
}

.game-topbar {
  padding: 10px 18px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  width: 100%;
  box-sizing: border-box;
}

.game-title-group {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--ink-3);
  font-weight: 500;
  margin-right: 6px;
}
.back-link:hover {
  color: var(--ink);
  text-decoration: none;
  border-color: transparent;
}

.game-title-group h1 {
  font-size: 20px;
}

.game-topbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.game-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 16px;
  align-items: stretch;
  width: 100%;
}
@media (max-width: 1024px) {
  .game-layout {
    grid-template-columns: 1fr;
  }
}

/* ================= 2x2 ОДНА ДОСКА ================= */
.team-board-wrapper {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
}

.team-players-bar {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: var(--gap-xs);
  height: 40px;
  min-height: 40px;
  padding: 0 10px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-m);
  box-sizing: border-box;
}

.team-slot {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.team-slot.left {
  justify-content: flex-start;
}

.team-slot.right {
  justify-content: flex-end;
}

.member-pill.compact {
  height: 28px;
  padding: 0 8px;
  font-size: 12px;
  border-radius: var(--r-s);
  max-width: 100%;
  white-space: nowrap;
}

.slot-num {
  font-size: 10px;
  font-weight: 700;
  color: var(--ink-3);
  background: color-mix(in srgb, var(--ink) 10%, transparent);
  border-radius: 50%;
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.clock-display.center {
  height: 32px;
  line-height: 32px;
  padding: 0 14px;
  min-width: 86px;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.team-members {
  display: flex;
  gap: var(--gap-xs);
  flex-wrap: wrap;
  flex: 1;
}

.member-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: var(--surface-inset);
  border: 1px solid var(--line);
  border-radius: var(--r-s);
  font-size: 13px;
  transition: background var(--t-fast), border-color var(--t-fast), box-shadow var(--t-fast);
}

/* Роли игроков */
.member-rating {
  font-size: 12px;
  color: var(--ink-3);
}

.member-pill.me .member-rating {
  color: var(--ink-2);
}

.member-pill.me {
  border-color: var(--accent-2);
  background: color-mix(in srgb, var(--accent) 12%, var(--surface));
  font-weight: 600;
}

.member-pill.partner {
  border-style: dashed;
  border-color: var(--felt-2);
  background: color-mix(in srgb, var(--felt) 9%, var(--surface));
}

.member-pill.opponent {
  opacity: 0.9;
}

/* Чья очередь */
.member-pill.active-turn {
  border-color: var(--accent);
  background: var(--accent-soft);
  box-shadow: 0 0 0 1.5px var(--accent-2);
}

.member-role {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 1px 5px;
  border-radius: var(--r-xs);
  white-space: nowrap;
}

.member-role.me {
  color: var(--accent-ink);
  background: var(--accent);
}

.member-role.partner {
  color: var(--felt-ink);
  background: var(--felt-2);
}

.turn-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--accent);
  color: var(--accent-ink);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: var(--r-xs);
  white-space: nowrap;
}

.turn-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.clock-display {
  font-size: 20px;
  font-weight: 700;
  padding: 4px 12px;
  border-radius: var(--r-s);
  background: var(--surface-inset);
  border: 1px solid var(--line);
  min-width: 84px;
  text-align: center;
}

.clock-display.running {
  background: var(--accent-soft);
  border-color: var(--accent-2);
  color: var(--accent);
  box-shadow: 0 0 8px color-mix(in srgb, var(--accent-2) 25%, transparent);
}

.board-frame {
  width: 100%;
  aspect-ratio: 1;
}

/* ================= БАГХАУС ================= */
.boards-container.two-boards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  width: 100%;
}
@media (max-width: 900px) {
  .boards-container.two-boards {
    grid-template-columns: 1fr;
  }
}

.bughouse-board-col {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.bughouse-board-col .board-wrap {
  max-width: min(100%, calc(100vh - 230px));
  margin: 0 auto;
}

.bughouse-board-col.my-board {
  padding: 6px;
  border-radius: var(--r-m);
  background: color-mix(in srgb, var(--accent) 6%, transparent);
  box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--accent) 40%, transparent);
}

.board-top-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2px 4px;
}

.board-number-badge {
  font-weight: 700;
  font-size: 13px;
}

.bughouse-clocks-bar {
  display: flex;
  justify-content: space-between;
  padding: 6px 12px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-s);
  font-size: 13.5px;
}

.b-clock-side {
  display: flex;
  gap: 6px;
  align-items: center;
}

.clock-active {
  color: var(--accent-2);
  font-weight: 700;
}

/* ================= САЙДБАР ================= */
.game-sidebar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
  height: 100%;
  min-height: 100%;
  box-sizing: border-box;
}

.queue-panel {
  flex: none;
}

.queue-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.queue-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}

.queue-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: var(--surface-inset);
  border: 1px solid var(--line);
  border-radius: var(--r-s);
  font-size: 12.5px;
}

.queue-order {
  font-size: 11px;
  font-weight: 700;
  width: 12px;
  text-align: center;
  opacity: 0.7;
}

.queue-item.me {
  border-color: var(--accent-2);
  background: color-mix(in srgb, var(--accent) 10%, var(--surface));
}

.queue-item.partner {
  border-style: dashed;
  border-color: var(--felt-2);
}

.queue-item.current {
  border-color: var(--accent);
  background: var(--accent-soft);
  font-weight: 600;
  box-shadow: 0 0 0 1.5px var(--accent-2);
}

.queue-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ink-3);
}
.queue-dot.on {
  background: var(--ok);
  box-shadow: 0 0 6px var(--ok);
}

.slot-note {
  margin-left: auto;
}

.turn-now-chip {
  font-size: 10px;
  color: var(--accent);
  font-weight: 700;
  letter-spacing: 0.05em;
}

/* ================= ПАНЕЛЬ ДЕБЮТА ================= */
.opening-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 190px;
}

.opening-head-title {
  display: flex;
  align-items: center;
  gap: 6px;
}

.opening-badges {
  display: flex;
  align-items: center;
  gap: 6px;
}

.eco-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: var(--r-xs);
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  color: var(--accent);
  border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
}

.stage-badge {
  font-size: 10.5px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: var(--r-xs);
}

.stage-badge.theory {
  background: color-mix(in srgb, var(--ok) 18%, transparent);
  color: var(--ok);
  border: 1px solid color-mix(in srgb, var(--ok) 35%, transparent);
}

.stage-badge.middlegame {
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: var(--accent);
  border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
}

.stage-badge.start {
  background: var(--surface-3);
  color: var(--ink-2);
}

.eval-pill {
  font-size: 11px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: var(--r-xs);
  transition: all 0.2s ease;
}

.eval-pill.eval-w {
  background: color-mix(in srgb, var(--ok) 20%, transparent);
  color: var(--ok);
  border: 1px solid color-mix(in srgb, var(--ok) 40%, transparent);
}

.eval-pill.eval-b {
  background: color-mix(in srgb, var(--accent) 20%, transparent);
  color: var(--accent);
  border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
}

.eval-pill.eval-eq {
  background: var(--surface-3);
  color: var(--ink-2);
  border: 1px solid var(--line);
}

/* Шкала и оценка позиции */
.eval-section {
  display: flex;
  flex-direction: column;
  gap: 5px;
  background: var(--surface-2);
  padding: 7px 9px;
  border-radius: var(--r-s);
  border: 1px solid var(--line);
}

.eval-bar-track {
  display: flex;
  height: 5px;
  width: 100%;
  border-radius: 3px;
  overflow: hidden;
  background: var(--surface-3);
}

.eval-bar-fill {
  height: 100%;
  transition: width 0.25s ease-out;
}

.eval-bar-fill.white {
  background: #ffffff;
}

.eval-bar-fill.black {
  background: #2b2b2b;
}

.eval-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.eval-verdict-text {
  font-size: 11px;
  font-weight: 600;
  color: var(--ink-2);
}

.material-badge {
  font-size: 10.5px;
  font-weight: 700;
  padding: 0 5px;
  border-radius: 3px;
}

.material-badge.mat-w {
  background: #ffffff;
  color: #111111;
}

.material-badge.mat-b {
  background: #222222;
  color: #ffffff;
  border: 1px solid #444444;
}

.opening-body {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
}

.opening-name-block {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.opening-title {
  font-size: 14.5px;
  font-weight: 700;
  color: var(--ink);
  margin: 0;
  line-height: 1.3;
}

.opening-variation {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
  margin: 0;
}

.opening-name-en {
  font-size: 11px;
  color: var(--ink-3);
}

/* Ветки теории */
.continuations-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.continuation-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.cont-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--surface-2);
  border: 1px solid var(--line);
  padding: 2px 7px;
  border-radius: var(--r-xs);
  font-size: 11px;
  cursor: default;
}

.cont-move {
  color: var(--accent);
  font-weight: 700;
}

.cont-var {
  font-size: 10px;
  color: var(--ink-3);
  max-width: 140px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Ходы партии */
.opening-moves-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.moves-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.moves-history-box {
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: var(--r-s);
  padding: 6px 8px;
  font-size: 11.5px;
  line-height: 1.45;
  color: var(--ink-2);
  max-height: 90px;
  overflow-y: auto;
  word-break: break-word;
}

.small-label {
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 600;
}

.opening-plan-box {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: var(--surface-2);
  padding: 8px 10px;
  border-radius: var(--r-s);
  border: 1px solid var(--line);
}

.plan-text {
  margin: 0;
  font-size: 11.5px;
  line-height: 1.45;
  color: var(--ink-2);
}

/* ================= ВЫДВИЖНОЙ ЧАТ ================= */
.chat-drawer-wrapper {
  height: 40px;
  min-height: 40px;
  flex: none;
  position: relative;
  box-sizing: border-box;
}

.chat-drawer-container {
  width: 100%;
  height: 40px;
  box-sizing: border-box;
}

.chat-bar-toggle {
  height: 40px;
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-m);
  cursor: pointer;
  user-select: none;
  box-sizing: border-box;
  transition: all 0.15s ease;
}

.chat-bar-toggle:hover {
  border-color: var(--accent);
  background: var(--surface-2);
}

.chat-bar-toggle.has-unread {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 15%, var(--surface));
}

.chat-toggle-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.chat-toggle-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--ink);
}

.unread-pill {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 10px;
  background: var(--accent);
  color: #000;
}

.chat-toggle-right {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--ink-2);
}

.chat-msg-count {
  font-size: 11px;
}

/* Раскрытая шторка: раскрывается вверх над панелью дебютов */
.chat-drawer-container.is-expanded {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 380px;
  max-height: calc(100vh - 260px);
  z-index: 30;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-m);
  box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.5);
  animation: slide-up-chat 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes slide-up-chat {
  from {
    transform: translateY(20px);
    opacity: 0.7;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.chat-drawer-container.is-expanded .chat-bar-toggle {
  border: none;
  border-bottom: 1px solid var(--line);
  border-radius: var(--r-m) var(--r-m) 0 0;
  background: var(--surface-2);
}

.chat-expanded-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 10px 12px;
  gap: 8px;
  overflow: hidden;
}

.chat-log {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.chat-msg {
  font-size: 13px;
  line-height: 1.35;
}

.chat-user {
  font-weight: 600;
  color: var(--accent-2);
  margin-right: 6px;
}

.system-msg {
  font-style: italic;
  font-size: 12px;
}

.chat-input-row {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

/* Модалки */
.promo-modal {
  max-width: 320px;
  padding: 20px;
  text-align: center;
}

.promo-pieces-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-top: 14px;
}

.promo-piece-btn {
  aspect-ratio: 1;
  padding: 6px;
}
.promo-piece-btn img {
  width: 100%;
  height: 100%;
}

.result-modal {
  max-width: 600px;
}

.headline-box {
  text-align: center;
  padding: 12px;
  background: var(--surface-inset);
  border-radius: var(--r-s);
  margin-bottom: var(--gap-m);
}

.headline-box h3 {
  font-size: 18px;
  color: var(--accent);
}

.next-game-hint {
  font-size: 13px;
  margin-top: 6px;
}

.rating-delta {
  display: inline-block;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 999px;
}

.rating-delta.plus {
  color: var(--ok);
  background: var(--ok-soft);
}

.rating-delta.minus {
  color: var(--bad);
  background: var(--bad-soft);
}

.analysis-box {
  margin-top: var(--gap-m);
  padding: var(--gap-m);
  background: var(--surface-inset);
  border: 1px solid var(--line);
  border-radius: var(--r-m);
}

.analysis-box h4 {
  margin-bottom: 4px;
}

.analysis-buttons {
  display: flex;
  gap: var(--gap-xs);
  flex-wrap: wrap;
  margin-top: var(--gap-s);
}

.small-hint {
  font-size: 12px;
}
.warn-text {
  color: var(--warn);
  font-size: 12.5px;
}

/* Мобильная адаптация игры: компактные панели игроков и максимум места под доску */
@media (max-width: 640px) {
  .game-page {
    gap: 10px;
  }
  .game-topbar {
    flex-wrap: wrap;
    gap: 8px;
  }
  .game-layout {
    gap: 12px;
  }
  .team-players-bar {
    padding: 2px 6px;
    gap: 4px;
    height: 36px;
    min-height: 36px;
  }
  .clock-display.center {
    font-size: 15px;
    padding: 0 8px;
    min-width: 60px;
    height: 28px;
    line-height: 28px;
  }
  .member-pill.compact {
    height: 26px;
    padding: 0 4px;
    font-size: 11px;
    gap: 3px;
  }
  .color-badge {
    font-size: 9px;
    padding: 1px 4px;
  }
  .member-rating {
    display: none;
  }
  .member-role {
    font-size: 9px;
    padding: 1px 4px;
  }
  .bughouse-clocks-bar {
    padding: 4px 8px;
    font-size: 12.5px;
  }
}
</style>
