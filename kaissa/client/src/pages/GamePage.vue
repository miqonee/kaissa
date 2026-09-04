<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Chess, type Square } from 'chess.js';
import type { ChatMessage, GameParticipantInfo, GameState, PieceType } from 'shared';
import { timeControlLabel } from 'shared';
import { getSocket } from '../api/socket';
import { useAuthStore } from '../stores/auth';
import { api } from '../api/rest';
import ChessBoard from '../components/ChessBoard.vue';
import PocketBar from '../components/PocketBar.vue';

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

const selectedDrop = ref<PieceType | null>(null);
const promoDialog = ref<{ board: 0 | 1; from: string; to: string } | null>(null);
const showResult = ref(false);
const disconnected = ref<{ userId: number; username: string }[]>([]);

const engines: (Chess | null)[] = [null, null];

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
    return [
      { index: 0 as const, orientation: 'white' as const },
      { index: 1 as const, orientation: 'black' as const },
    ];
  }
  return [{ index: 0 as const, orientation: 'white' as const }];
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

function movableOn(b: 0 | 1): 'white' | 'black' | null {
  if (!myTurnOn(b)) return null;
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

function rebuildLocalClocks(): void {
  if (!state.value) return;
  localClocks.value = state.value.clocks.map((c) => [c[0], c[1]] as [number, number]);
}

watch(() => state.value?.clocks, rebuildLocalClocks, { deep: true });

function tickClocks(): void {
  if (!state.value || state.value.status !== 'active') return;
  const st = state.value;
  st.clocks.forEach((_, b) => {
    const active = st.clocksActive[b];
    if (!active) return;
    const colorIdx = active === 'w' ? 0 : 1;
    const cur = localClocks.value[b]?.[colorIdx] ?? 0;
    if (localClocks.value[b]) localClocks.value[b][colorIdx] = Math.max(0, cur - 500);
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

// ---------- Действия ----------

function onMove(b: 0 | 1, payload: { from: string; to: string }): void {
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

onMounted(() => {
  socket.emit('game:watch', gameId);

  socket.on('game:state', (st) => {
    if (st.gameId !== gameId) return;
    state.value = st;
    if (st.status !== 'active') showResult.value = true;
    rebuildLocalClocks();
  });

  socket.on('game:move', (mv) => {
    if (mv.gameId !== gameId) return;
    lastMoves.value = {
      ...lastMoves.value,
      [mv.boardIndex]: mv.dropPiece ? [mv.to, mv.to] : [mv.from, mv.to],
    };
    socket.emit('game:watch', gameId);
    selectedDrop.value = null;
  });

  socket.on('game:clock', (payload) => {
    if (payload.gameId !== gameId) return;
    if (state.value) {
      state.value.clocks = payload.clocks;
      rebuildLocalClocks();
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
  });

  socket.on('game:chat', (msg) => {
    if (msg.gameId !== gameId) return;
    chat.value.push(msg);
    scrollChat();
  });

  socket.on('game:players-left', (payload) => {
    if (payload.gameId !== gameId) return;
    disconnected.value = payload.left;
  });

  ticker = window.setInterval(tickClocks, 500);
});

onBeforeUnmount(() => {
  socket.off('game:state');
  socket.off('game:move');
  socket.off('game:clock');
  socket.off('game:end');
  socket.off('game:chat');
  socket.off('game:players-left');
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
    const res = await api.post<{ url: string }>(`/api/games/${gameId}/lichess-import?board=${boardIdx}`, {});
    if (res.url) {
      window.open(res.url, '_blank');
    }
  } catch (e: any) {
    // Резервный вариант: скачиваем PGN и открываем lichess.org/paste
    window.open(`/api/games/${gameId}/pgn?download=1`, '_blank');
    window.open('https://lichess.org/paste', '_blank');
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
  abandoned: 'Партия брошена',
};

function resultHeadline(): string {
  if (!state.value || state.value.status === 'active') return '';
  const s = state.value;
  const reason = REASONS[s.reason ?? ''] ?? s.reason ?? '';
  if (s.status === 'abandoned' || s.result === '*') return `Партия брошена (${reason})`;
  const winnerTeam = s.result === '1-0' ? 1 : 2;
  const winners = s.participants.filter((p) => p.team === winnerTeam).map((p) => p.username);
  return `Победа команды: ${winners.join(' / ')} (${reason})`;
}
</script>

<template>
  <div v-if="state" class="game-page" :class="state.mode">
    <!-- Верхняя информационная плашка -->
    <div class="game-topbar panel">
      <div class="game-title-group">
        <router-link to="/" class="back-link" title="К столам">← Столы</router-link>
        <h1>
          {{ state.mode === 'bughouse' ? 'Багхаус' : 'Матч 2×2 (одна доска)' }}
        </h1>
        <span class="badge mono">{{ timeControlLabel(state.timeControl) }}</span>
        <span v-if="state.status === 'active'" class="badge on">В игре</span>
        <span v-else class="badge">{{ state.result }}</span>
        <span v-if="!isParticipant" class="badge">Режим зрителя</span>
      </div>

      <div class="game-topbar-actions">
        <button v-if="isParticipant && state.status === 'active'" class="danger small" @click="resign">
          Сдаться
        </button>
        <button v-if="state.status !== 'active'" class="small brass" @click="analyzeOnLichess(0)">
          Анализ на Lichess ↗
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
            <div class="team-color-indicator" :class="teamModeSides.top.color">
              {{ teamModeSides.top.color === 'w' ? 'Белые' : 'Черные' }}
            </div>
            <div class="team-members">
              <div
                v-for="p in teamModeSides.top.players"
                :key="p.userId"
                class="member-pill"
                :class="{
                  'active-turn': isPlayerTurn(p.userId),
                  'is-me': p.userId === myId
                }"
              >
                <span class="slot-badge mono">Ход {{ p.moveSlot + 1 }}</span>
                <span class="member-name">{{ p.username }}</span>
                <span class="member-rating mono">({{ p.ratingBefore }})</span>
                <span v-if="isPlayerTurn(p.userId)" class="turn-chip">Ходит</span>
              </div>
            </div>
            <div class="clock-display mono" :class="{ running: state.clocksActive[0] === teamModeSides.top.color }">
              {{ fmtClock(clockMs(0, teamModeSides.top.color)) }}
            </div>
          </div>

          <!-- Сама доска -->
          <div class="board-frame">
            <ChessBoard
              :fen="fenOf(0)"
              :orientation="orientationOf(0)"
              :movable-color="movableOn(0)"
              :dests="destsByBoard[0]"
              :check-square="checkByBoard[0]"
              :last-move="lastMoveOf(0)"
              :coordinates="true"
              @move="onMove(0, $event)"
            />
          </div>

          <!-- Нижняя команда (моя сторона) -->
          <div class="team-players-bar bottom">
            <div class="team-color-indicator" :class="teamModeSides.bottom.color">
              {{ teamModeSides.bottom.color === 'w' ? 'Белые' : 'Черные' }}
            </div>
            <div class="team-members">
              <div
                v-for="p in teamModeSides.bottom.players"
                :key="p.userId"
                class="member-pill"
                :class="{
                  'active-turn': isPlayerTurn(p.userId),
                  'is-me': p.userId === myId
                }"
              >
                <span class="slot-badge mono">Ход {{ p.moveSlot + 1 }}</span>
                <span class="member-name">{{ p.username }}</span>
                <span class="member-rating mono">({{ p.ratingBefore }})</span>
                <span v-if="isPlayerTurn(p.userId)" class="turn-chip">Ходит</span>
              </div>
            </div>
            <div class="clock-display mono" :class="{ running: state.clocksActive[0] === teamModeSides.bottom.color }">
              {{ fmtClock(clockMs(0, teamModeSides.bottom.color)) }}
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
              :dests="destsByBoard[bc.index]"
              :check-square="checkByBoard[bc.index]"
              :last-move="lastMoveOf(bc.index)"
              :drop-piece="myTurnOn(bc.index) ? selectedDrop : null"
              :coordinates="true"
              @move="onMove(bc.index, $event)"
              @drop="onDrop(bc.index, $event)"
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
                Партнеры чередуются через ход: Слот 1 → Слот 2 → Слот 1.
              </p>
              <div class="queue-list">
                <div
                  v-for="p in state.participants"
                  :key="p.userId"
                  class="queue-item"
                  :class="{ current: isPlayerTurn(p.userId) }"
                >
                  <span class="queue-dot" :class="{ on: isPlayerTurn(p.userId) }"></span>
                  <span class="queue-color-tag" :class="p.color">
                    {{ p.color === 'w' ? 'Белые' : 'Черные' }}
                  </span>
                  <span class="queue-name">{{ p.username }}</span>
                  <span class="dim mono">слот {{ p.moveSlot + 1 }}</span>
                  <span v-if="isPlayerTurn(p.userId)" class="turn-now-chip">СЕЙЧАС ХОД</span>
                </div>
              </div>
            </div>

            <div v-else class="queue-bughouse-hint">
              <p class="small-hint dim">
                Обе доски играют одновременно. Кликните по фигуре в кармане и затем по пустой клетке для дропа.
              </p>
            </div>

            <p v-if="disconnected.length" class="warn-text">
              Отключились: {{ disconnected.map((d) => d.username).join(', ') }}
            </p>
            <p v-if="error" class="error-text">{{ error }}</p>
          </div>
        </div>

        <!-- Чат -->
        <div class="panel chat-panel">
          <div class="panel-head">
            <h3>Чат матча</h3>
            <span class="hint">{{ chat.length }}</span>
          </div>
          <div class="panel-body chat-body">
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
              <button type="submit" class="primary">→</button>
            </form>
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

    <!-- Модальное окно завершения партии с PGN / Lichess -->
    <div v-if="showResult && state.status !== 'active'" class="modal-backdrop">
      <div class="modal result-modal">
        <div class="modal-head">
          <h2>Партия завершена</h2>
          <button class="modal-close" @click="showResult = false">✕</button>
        </div>

        <div class="modal-body">
          <div class="headline-box">
            <h3>{{ resultHeadline() }}</h3>
          </div>

          <!-- Таблица изменений рейтинга -->
          <table class="club result-table">
            <thead>
              <tr>
                <th>Игрок</th>
                <th>Команда</th>
                <th>Было</th>
                <th>±</th>
                <th>Итог</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in state.participants" :key="p.userId">
                <td style="font-weight: 600;">{{ p.username }}</td>
                <td>Команда {{ p.team }} ({{ p.color === 'w' ? 'белые' : 'черные' }})</td>
                <td class="mono dim">{{ p.ratingBefore }}</td>
                <td class="mono" :class="{ 'plus': (p.ratingAfter ?? p.ratingBefore) > p.ratingBefore, 'minus': (p.ratingAfter ?? p.ratingBefore) < p.ratingBefore }">
                  <span v-if="p.ratingAfter !== null">
                    {{ p.ratingAfter - p.ratingBefore > 0 ? '+' : '' }}{{ p.ratingAfter - p.ratingBefore }}
                  </span>
                </td>
                <td class="mono" style="font-weight: 700;">{{ p.ratingAfter ?? p.ratingBefore }}</td>
              </tr>
            </tbody>
          </table>

          <!-- Кнопки анализа на Lichess -->
          <div class="analysis-box panel">
            <div class="analysis-text">
              <h4>Анализ партии</h4>
              <p class="dim small-hint">
                Экспортируйте ходы в формате PGN или откройте движок Stockfish прямо на Lichess для глубокого разбора.
              </p>
            </div>
            <div class="analysis-buttons">
              <a :href="`/api/games/${gameId}/pgn?download=1`" class="button" download>
                ⬇ Скачать PGN
              </a>
              <button
                class="brass"
                :disabled="lichessBusy"
                @click="analyzeOnLichess(0)"
              >
                {{ lichessBusy ? 'Открываем…' : 'Анализ на Lichess ↗' }}
              </button>
              <button
                v-if="state.mode === 'bughouse'"
                class="small ghost"
                @click="analyzeOnLichess(1)"
              >
                Доска 2 на Lichess ↗
              </button>
            </div>
          </div>
        </div>

        <div class="modal-foot">
          <button v-if="isParticipant" class="primary big" :disabled="rematchBusy" @click="rematch">
            {{ rematchBusy ? 'Создаём…' : 'Реванш ↺' }}
          </button>
          <router-link :to="`/replay/${gameId}`" class="button">
            Просмотр ходов
          </router-link>
          <router-link to="/" class="button ghost">
            В лобби
          </router-link>
        </div>
      </div>
    </div>
  </div>

  <div v-else class="empty">Подключение к партии #{{ gameId }}…</div>
</template>

<style scoped>
.game-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.game-topbar {
  padding: 12px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
}

.game-title-group {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.back-link {
  color: var(--ink-faint);
  font-weight: 500;
  margin-right: 6px;
}
.back-link:hover {
  color: var(--ink);
  text-decoration: none;
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
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 20px;
  align-items: start;
}
@media (max-width: 1024px) {
  .game-layout {
    grid-template-columns: 1fr;
  }
}

/* ================= 2x2 ОДНА ДОСКА ================= */
.team-board-wrapper {
  max-width: 680px;
  margin: 0 auto;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.team-players-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 14px;
  background: var(--bg-card);
  border: 1px solid var(--line);
  border-radius: var(--r-m);
}

.team-color-indicator {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 3px 8px;
  border-radius: var(--r-s);
}
.team-color-indicator.w {
  background: #fff;
  color: #111;
  border: 1px solid #bbb;
}
.team-color-indicator.b {
  background: #111;
  color: #fff;
}

.team-members {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  flex: 1;
}

.member-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: var(--bg-inset);
  border: 1px solid var(--line);
  border-radius: var(--r-s);
  font-size: 13px;
  transition: all 0.15s;
}

.member-pill.active-turn {
  border-color: var(--brass);
  background: color-mix(in srgb, var(--brass) 18%, var(--bg-card));
  box-shadow: 0 0 0 1.5px var(--brass);
}

.member-pill.is-me {
  font-weight: 600;
}

.slot-badge {
  font-size: 10.5px;
  color: var(--ink-faint);
  background: var(--bg-card);
  padding: 1px 5px;
  border-radius: 3px;
}

.turn-chip {
  background: var(--brass);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  padding: 1px 5px;
  border-radius: 3px;
}

.clock-display {
  font-size: 20px;
  font-weight: 700;
  padding: 4px 12px;
  border-radius: var(--r-s);
  background: var(--bg-inset);
  border: 1px solid var(--line);
  min-width: 80px;
  text-align: center;
}
.clock-display.running {
  background: var(--bg-card);
  border-color: var(--brass);
  color: var(--brass);
  box-shadow: 0 0 8px color-mix(in srgb, var(--brass) 25%, transparent);
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
}
@media (max-width: 800px) {
  .boards-container.two-boards {
    grid-template-columns: 1fr;
  }
}

.bughouse-board-col {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.bughouse-board-col.my-board {
  padding: 6px;
  border-radius: var(--r-m);
  background: color-mix(in srgb, var(--brass) 6%, transparent);
  box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--brass) 40%, transparent);
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
  background: var(--bg-card);
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
  color: var(--brass);
  font-weight: 700;
}

/* ================= САЙДБАР ================= */
.game-sidebar {
  display: flex;
  flex-direction: column;
  gap: 16px;
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
  background: var(--bg-inset);
  border: 1px solid var(--line);
  border-radius: var(--r-s);
  font-size: 12.5px;
}

.queue-item.current {
  border-color: var(--brass);
  background: color-mix(in srgb, var(--brass) 14%, var(--bg-card));
  font-weight: 600;
}

.queue-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ink-faint);
}
.queue-dot.on {
  background: var(--ok);
  box-shadow: 0 0 6px var(--ok);
}

.queue-color-tag {
  font-size: 10.5px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 3px;
}
.queue-color-tag.w { background: #fff; color: #111; border: 1px solid #ccc; }
.queue-color-tag.b { background: #111; color: #fff; }

.turn-now-chip {
  margin-left: auto;
  font-size: 10px;
  color: var(--brass);
  font-weight: 700;
  letter-spacing: 0.05em;
}

/* Чат */
.chat-panel {
  display: flex;
  flex-direction: column;
}

.chat-body {
  height: 320px;
  display: flex;
  flex-direction: column;
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
  color: var(--brass);
  margin-right: 6px;
}

.system-msg {
  font-style: italic;
  font-size: 12px;
}

.chat-input-row {
  display: flex;
  gap: 8px;
  margin-top: 10px;
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
  max-width: 580px;
}

.headline-box {
  text-align: center;
  padding: 12px;
  background: var(--bg-inset);
  border-radius: var(--r-s);
  margin-bottom: 16px;
}

.headline-box h3 {
  font-size: 18px;
  color: var(--brass);
}

.result-table td.plus { color: var(--ok); font-weight: 700; }
.result-table td.minus { color: var(--bad); font-weight: 700; }

.analysis-box {
  margin-top: 18px;
  padding: 14px 18px;
}

.analysis-box h4 {
  margin-bottom: 4px;
}

.analysis-buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 10px;
}

.small-hint {
  font-size: 12px;
}
.warn-text {
  color: var(--warn);
  font-size: 12.5px;
}
</style>
