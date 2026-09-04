<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Chess, type Square } from 'chess.js';
import type {
  ChatMessage,
  GameParticipantInfo,
  GameState,
  PieceType,
} from 'shared';
import { timeControlLabel } from 'shared';
import { getSocket } from '../api/socket';
import { useAuthStore } from '../stores/auth';
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

/** Нереактивные экземпляры chess.js: генерация ходов мутирует внутреннее
 *  состояние, поэтому держим их вне реактивности Vue. */
const engines: (Chess | null)[] = [null, null];
/** выбранная фигура для дропа (только своя доска) */
const selectedDrop = ref<PieceType | null>(null);
/** диалог промоушена */
const promoDialog = ref<{ board: 0 | 1; from: string; to: string } | null>(null);

// ---------- Вычисляемое ----------

const myId = computed(() => auth.user?.id ?? 0);
const isParticipant = computed(() => state.value?.participants.some((p) => p.userId === myId.value) ?? false);
const myParticipant = computed(() => state.value?.participants.find((p) => p.userId === myId.value) ?? null);

/** моя доска (для багхауса) */
const myBoard = computed<0 | 1 | null>(() => {
  if (!state.value || state.value.mode !== 'bughouse') return null;
  if (!myParticipant.value) return null;
  return myParticipant.value.boardIndex;
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

/** ориентация доски: чёрные внизу на доске моего чёрного партнёра? нет —
 *  каждая доска: белые снизу; для чёрного игрока на его доске — переворачиваем.
 */
function orientationOf(b: 0 | 1): 'white' | 'black' {
  if (!state.value) return 'white';
  // если я участник этой доски и мой цвет чёрный — доска чёрными вниз
  if (isParticipant.value && myParticipant.value?.boardIndex === b && myParticipant.value.color === 'b') return 'black';
  // зритель: доска 0 белыми вниз, доска 1 — тоже белыми (партнёрские доски согласованы)
  return 'white';
}

/** мой ли сейчас ход на доске b */
function myTurnOn(b: 0 | 1): boolean {
  if (!state.value || state.value.status !== 'active') return false;
  const idx = state.value.mode === 'bughouse' ? b : 0;
  const uid = state.value.turnUserIds[idx] ?? 0;
  return uid === myId.value;
}

/** могу ли двигать фигуры на доске b */
function movableOn(b: 0 | 1): 'white' | 'black' | null {
  if (!myTurnOn(b)) return null;
  if (state.value!.mode === 'team') return myParticipant.value?.color === 'w' ? 'white' : 'black';
  return myParticipant.value?.color === 'w' ? 'white' : 'black';
}

/** Легальные ходы по доскам — считаются один раз на новое состояние */
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
    } catch {
      /* позиция ещё не пришла */
    }
  }
  return out;
});

/** Клетки королей под шахом по доскам */
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
    } catch {
      /* игнорируем */
    }
  }
  return out;
});

/** Последний ход по доскам (для подсветки) — пополняется из событий */
const lastMoves = ref<Record<number, (string | null)[]>>({ 0: [null, null], 1: [null, null] });

function lastMoveOf(b: 0 | 1): (string | null)[] | null {
  const lm = lastMoves.value[b];
  return lm && (lm[0] || lm[1]) ? lm : null;
}

/** чей карман показывать у доски b (свои карманы интерактивны) */
function pocketOfBoard(b: 0 | 1, color: 'w' | 'b') {
  if (!state.value || !state.value.pockets) return null;
  const p = state.value.participants.find(
    (x) => x.boardIndex === b && x.color === color,
  );
  if (!p) return null;
  return state.value.pockets[state.value.participants.indexOf(p)] ?? null;
}

// ---------- Часы (локальный тик) ----------
const localClocks = ref<[number, number][]>([]);
const clockTick = ref(0);
let ticker: number | undefined;

function rebuildLocalClocks(): void {
  if (!state.value) return;
  localClocks.value = state.value.clocks.map((c, i) => [c[0], c[1]] as [number, number]);
}

watch(() => state.value?.clocks, rebuildLocalClocks, { deep: true });

function tickClocks(): void {
  clockTick.value++;
  if (!state.value) return;
  const st = state.value;
  st.clocks.forEach((c, b) => {
    const active = st.clocksActive[b];
    if (!active) return;
    const colorIdx = active === 'w' ? 0 : 1;
    const dec = 500;
    const cur = localClocks.value[b]?.[colorIdx] ?? 0;
    if (localClocks.value[b]) localClocks.value[b][colorIdx] = Math.max(0, cur - dec);
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

// ---------- Действия ----------

function onMove(b: 0 | 1, payload: { from: string; to: string }): void {
  let c: Chess;
  try {
    c = new Chess(fenOf(b));
  } catch {
    return;
  }
  // промоушен?
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
      // синхронизируемся заново при ошибке
      socket.emit('game:watch', gameId);
    }
  });
}

function onDrop(b: 0 | 1, payload: { piece: PieceType; to: string }): void {
  selectedDrop.value = null;
  sendMove(b, '-', payload.to, undefined, payload.piece);
}

function resign(): void {
  if (confirm('Сдаться?')) socket.emit('game:resign', gameId);
}

function sendChat(): void {
  const t = chatText.value.trim();
  if (!t) return;
  socket.emit('game:chat', gameId, t);
  chatText.value = '';
}

/** Обновить нереактивные движки из FEN */
function syncLocal(b: 0 | 1): void {
  const fen = fenOf(b);
  try {
    engines[b] = fen ? new Chess(fen) : null;
  } catch {
    engines[b] = null;
  }
}

function applyServerMove(mv: {
  boardIndex: 0 | 1;
  from: string;
  to: string;
  promotion?: PieceType;
  dropPiece?: PieceType;
}): void {
  // Полное состояние придёт отдельным game:state; здесь только сбрасываем выбор дропа
  selectedDrop.value = null;
  void mv;
}

// ---------- Lifecycle ----------

onMounted(() => {
  socket.emit('game:watch', gameId);

  socket.on('game:state', (st) => {
    if (st.gameId !== gameId) return;
    state.value = st;
    syncLocal(0);
    if (st.mode === 'bughouse') syncLocal(1);
    rebuildLocalClocks();
  });
  socket.on('game:move', (mv) => {
    if (mv.gameId !== gameId) return;
    lastMoves.value = {
      ...lastMoves.value,
      [mv.boardIndex]: mv.dropPiece ? [mv.to, mv.to] : [mv.from, mv.to],
    };
    // сервер — источник истины: подтягиваем полное состояние
    socket.emit('game:watch', gameId);
    applyServerMove(mv);
  });
  socket.on('game:clock', (payload) => {
    if (payload.gameId !== gameId) return;
    // заменить базовые часы; локальный тик продолжит
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

  // Если это моя активная партия — сервер сам подсоединил. Зритель запросит watch.
});

onBeforeUnmount(() => {
  socket.emit('lobby:leave'); // на всякий случай выйти из лобби-комнат
  socket.off('game:state');
  socket.off('game:move');
  socket.off('game:clock');
  socket.off('game:end');
  socket.off('game:chat');
  socket.off('game:players-left');
  clearInterval(ticker);
});

const disconnected = ref<{ userId: number; username: string }[]>([]);
const showResult = ref(false);
const rematchLobby = ref<string | null>(null);

async function rematch(): Promise<void> {
  const res = await fetch(`/api/games/${gameId}/rematch`, {
    method: 'POST',
    credentials: 'include',
  });
  if (res.ok) {
    const data = (await res.json()) as { lobbyId: string };
    router.push(`/lobby/${data.lobbyId}`);
  }
}

function scrollChat(): void {
  setTimeout(() => {
    if (chatBox.value) chatBox.value.scrollTop = chatBox.value.scrollHeight;
  }, 30);
}

// ---------- Отображение ----------

const REASONS: Record<string, string> = {
  checkmate: 'мат',
  resign: 'сдача',
  timeout: 'время истекло',
  stalemate: 'пат',
  material: 'недостаток материала',
  repetition: 'троекратное повторение',
  fifty: 'правило 50 ходов',
  abandoned: 'партия брошена',
};

function resultText(): string {
  if (!state.value) return '';
  const s = state.value;
  if (s.status === 'active') return '';
  const winnerTeam = s.result === '1-0' ? 1 : 2;
  const reason = REASONS[s.reason ?? ''] ?? '';
  if (s.status === 'abandoned' || s.result === '*') return `Партия брошена (${reason})`;
  const winners = s.participants.filter((p) => p.team === winnerTeam).map((p) => p.username);
  const losers = s.participants.filter((p) => p.team !== winnerTeam).map((p) => p.username);
  return `Победили ${winners.join(' и ')} против ${losers.join(' и ')} — ${reason}`;
}

function teamOfBoardColorClient(b: 0 | 1, color: 'w' | 'b'): 1 | 2 {
  if (b === 0) return color === 'w' ? 1 : 2;
  return color === 'w' ? 2 : 1;
}

/** игроки над/под доской */
function boardPlayers(b: 0 | 1): { top: GameParticipantInfo | undefined; bottom: GameParticipantInfo | undefined } {
  if (!state.value) return { top: undefined, bottom: undefined };
  const st = state.value;
  const topColor: 'w' | 'b' = orientationOf(b) === 'white' ? 'b' : 'w';
  const bottomColor: 'w' | 'b' = topColor === 'w' ? 'b' : 'w';
  const mk = (color: 'w' | 'b') =>
    st.participants.find(
      (p) => p.boardIndex === (st.mode === 'bughouse' ? b : 0) && p.color === color,
    );
  return { top: mk(topColor), bottom: mk(bottomColor) };
}
</script>

<template>
  <div v-if="state" class="game-page" :class="{ bughouse: state.mode === 'bughouse' }">
    <!-- Верх: заголовок -->
    <div class="game-head">
      <h2>
        {{ state.mode === 'bughouse' ? 'Багхаус' : 'Партия 2×2' }}
        <span class="badge mono">{{ timeControlLabel(state.timeControl) }}</span>
      </h2>
      <span v-if="state.status === 'active'" class="badge on">идёт</span>
      <span v-if="!isParticipant" class="badge">вы зритель</span>
    </div>

    <div class="game-grid">
      <!-- Доски -->
      <div class="boards-area">
        <div
          v-for="bc in boardsConfig"
          :key="bc.index"
          class="board-col"
          :class="{ mine: isParticipant && myBoard === bc.index }"
        >
          <!-- Верхний игрок -->
          <div class="player-bar top">
            <template v-if="boardPlayers(bc.index).top">
              <span class="dot" :class="{ on: !disconnected.some((d) => d.userId === boardPlayers(bc.index).top!.userId) }"></span>
              <span class="p-name">{{ boardPlayers(bc.index).top!.username }}</span>
              <span class="mono p-rating">{{ boardPlayers(bc.index).top!.ratingBefore }}</span>
              <span v-if="state.turnUserIds[bc.index] === boardPlayers(bc.index).top!.userId" class="turn-mark">ход</span>
              <span class="clock mono" :class="{ active: state.clocksActive[bc.index] === (boardPlayers(bc.index).top!.color as 'w'|'b') }">
                {{ fmtClock(clockMs(bc.index, boardPlayers(bc.index).top!.color as 'w'|'b')) }}
              </span>
            </template>
          </div>

          <!-- Карман верхнего игрока (bughouse) -->
          <PocketBar
            v-if="state.mode === 'bughouse' && pocketOfBoard(bc.index, orientationOf(bc.index) === 'white' ? 'b' : 'w')"
            :pocket="pocketOfBoard(bc.index, orientationOf(bc.index) === 'white' ? 'b' : 'w')!"
            :color="orientationOf(bc.index) === 'white' ? 'b' : 'w'"
            :interactive="false"
            :selected="null"
          />

          <!-- Доска -->
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

          <!-- Карман нижнего игрока -->
          <PocketBar
            v-if="state.mode === 'bughouse' && pocketOfBoard(bc.index, orientationOf(bc.index) === 'white' ? 'w' : 'b')"
            :pocket="pocketOfBoard(bc.index, orientationOf(bc.index) === 'white' ? 'w' : 'b')!"
            :color="orientationOf(bc.index) === 'white' ? 'w' : 'b'"
            :interactive="myTurnOn(bc.index)"
            :selected="selectedDrop"
            @select="selectedDrop = $event"
          />

          <!-- Нижний игрок -->
          <div class="player-bar bottom">
            <template v-if="boardPlayers(bc.index).bottom">
              <span class="dot" :class="{ on: !disconnected.some((d) => d.userId === boardPlayers(bc.index).bottom!.userId) }"></span>
              <span class="p-name">{{ boardPlayers(bc.index).bottom!.username }}</span>
              <span class="mono p-rating">{{ boardPlayers(bc.index).bottom!.ratingBefore }}</span>
              <span v-if="state.turnUserIds[bc.index] === boardPlayers(bc.index).bottom!.userId" class="turn-mark">ход</span>
              <span class="clock mono" :class="{ active: state.clocksActive[bc.index] === (boardPlayers(bc.index).bottom!.color as 'w'|'b') }">
                {{ fmtClock(clockMs(bc.index, boardPlayers(bc.index).bottom!.color as 'w'|'b')) }}
              </span>
            </template>
          </div>
        </div>
      </div>

      <!-- Сайдбар: сдача + чат -->
      <aside class="side">
        <div class="panel">
          <div class="panel-head"><h3>Партия #{{ state.gameId }}</h3></div>
          <div class="panel-body side-actions">
            <button v-if="isParticipant && state.status === 'active'" class="danger" @click="resign">
              Сдаться
            </button>
            <p v-if="disconnected.length" class="dim warn-text">
              Отключились: {{ disconnected.map((d) => d.username).join(', ') }}
            </p>
            <p v-if="error" class="error-text">{{ error }}</p>
          </div>
        </div>

        <div class="panel chat-panel">
          <div class="panel-head"><h3>Чат</h3></div>
          <div class="panel-body chat-body">
            <div ref="chatBox" class="chat-log">
              <div v-for="m in chat" :key="m.id" class="chat-msg" :class="{ system: m.system }">
                <template v-if="m.system"><span class="dim">{{ m.text }}</span></template>
                <template v-else><span class="chat-user">{{ m.username }}:</span> {{ m.text }}</template>
              </div>
            </div>
            <form class="chat-input" @submit.prevent="sendChat">
              <input v-model="chatText" placeholder="Сообщение…" maxlength="300" />
              <button class="primary">→</button>
            </form>
          </div>
        </div>
      </aside>
    </div>

    <!-- Промоушен -->
    <div v-if="promoDialog" class="promo-overlay" @click.self="promoDialog = null">
      <div class="promo panel">
        <h3>Превращение пешки</h3>
        <div class="promo-row">
          <button v-for="t in ['q', 'r', 'b', 'n']" :key="t" @click="choosePromotion(t as PieceType)">
            <img :src="`/pieces/cburnett/${myParticipant?.color ?? 'w'}${t.toUpperCase()}.svg`" :alt="t" class="promo-piece" />
          </button>
        </div>
      </div>
    </div>

    <!-- Результат -->
    <div v-if="showResult && state.status !== 'active'" class="promo-overlay">
      <div class="promo panel result-panel">
        <h2>{{ resultText() }}</h2>
        <table class="club">
          <thead>
            <tr><th>Игрок</th><th>±</th><th>Рейтинг</th></tr>
          </thead>
          <tbody>
            <tr v-for="p in state.participants" :key="p.userId">
              <td>{{ p.username }}</td>
              <td class="mono" :class="{ up: (p.ratingAfter ?? p.ratingBefore) > p.ratingBefore, down: (p.ratingAfter ?? p.ratingBefore) < p.ratingBefore }">
                {{ p.ratingAfter !== null ? ((p.ratingAfter - p.ratingBefore > 0 ? '+' : '') + (p.ratingAfter - p.ratingBefore)) : '' }}
              </td>
              <td class="mono">{{ p.ratingAfter ?? p.ratingBefore }}</td>
            </tr>
          </tbody>
        </table>
        <div class="result-actions">
          <button v-if="isParticipant" class="primary" @click="rematch">Реванш</button>
          <button @click="router.push('/')">На главную</button>
          <button @click="router.push(`/replay/${gameId}`)">Просмотр ходов</button>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="empty">{{ error || 'Подключение к партии…' }}</div>
</template>

<style scoped>
.game-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}

.game-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 20px;
  align-items: start;
}

.boards-area {
  display: grid;
  gap: 20px;
  grid-template-columns: 1fr;
}

.game-page.bughouse .boards-area {
  grid-template-columns: 1fr 1fr;
}

.board-col {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.board-col.mine {
  outline: 2px solid color-mix(in srgb, var(--brass) 55%, transparent);
  outline-offset: 6px;
  border-radius: var(--r-m);
  padding: 4px;
}

.player-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  padding: 2px 4px;
}

.p-name { font-weight: 600; }
.p-rating { color: var(--ink-faint); font-size: 13px; }

.turn-mark {
  background: var(--brass);
  color: #fff;
  font-size: 11px;
  border-radius: 4px;
  padding: 1px 6px;
  font-weight: 600;
}

.clock {
  margin-left: auto;
  font-size: 16px;
  font-weight: 600;
  color: var(--ink-soft);
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--bg-inset);
  border: 1px solid var(--line);
}

.clock.active {
  color: var(--ink);
  border-color: var(--brass-strong);
  background: #fff;
}

.side { display: flex; flex-direction: column; gap: 16px; }

.side-actions { display: flex; flex-direction: column; gap: 10px; }

.chat-panel { flex: 1; min-height: 400px; display: flex; flex-direction: column; }
.chat-panel .panel-body { display: flex; flex-direction: column; flex: 1; }

.chat-body { display: flex; flex-direction: column; height: 320px; }
.chat-log { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
.chat-user { font-weight: 600; color: var(--felt); }
.chat-input { display: flex; gap: 8px; margin-top: 10px; }

.warn-text { color: var(--warn); }

.dim { color: var(--ink-faint); }

/* Промоушен / результат */
.promo-overlay {
  position: fixed;
  inset: 0;
  background: rgba(38, 35, 28, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.promo {
  padding: 20px;
  min-width: 320px;
}

.promo-row { display: flex; gap: 8px; margin-top: 14px; }
.promo-row button { padding: 6px; width: 64px; height: 64px; }
.promo-piece { width: 100%; height: 100%; }

.result-panel { min-width: 420px; }
.result-actions { display: flex; gap: 10px; margin-top: 16px; justify-content: flex-end; }

.up { color: var(--ok); }
.down { color: var(--bad); }
</style>
