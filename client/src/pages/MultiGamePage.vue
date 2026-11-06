<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type {
  ChatMessage,
  GameParticipantInfo,
  GameState,
  MultiColor,
  MultiMode,
  SeatStatus,
} from 'shared';
import {
  getBotPersonality,
  getTopology,
  modeLabel,
  MultiChess,
  SEAT_COLORS,
  timeControlLabel,
} from 'shared';
import { applyEndUpdate } from '../game/sync';
import { ratingLabel } from '../utils/match';
import { getSocket, onSocketResync } from '../api/socket';
import { api } from '../api/rest';
import { useAuthStore } from '../stores/auth';
import { useI18n } from '../stores/i18n';
import { usePageSeo } from '../composables/useSeo';
import { trackGoal } from '../utils/analytics';
import {
  playCaptureSound,
  playCheckSound,
  playGameEndSound,
  playMoveSound,
} from '../audio/sounds';
import MultiBoard from '../components/MultiBoard.vue';
import ChatWidget from '../components/ChatWidget.vue';
import AppIcon from '../components/AppIcon.vue';
import BotHoverCard from '../components/BotHoverCard.vue';
import MatchCard from '../components/MatchCard.vue';
import GuestNotice from '../components/GuestNotice.vue';
import GameReplayModal from '../components/GameReplayModal.vue';

const props = withDefaults(
  defineProps<{
    initialState?: GameState | null;
  }>(),
  { initialState: null },
);

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const i18n = useI18n();
const socket = getSocket();

const gameId = Number(route.params.id);
const state = ref<GameState | null>(props.initialState ?? null);
const error = ref('');
const chat = ref<ChatMessage[]>([]);
const disconnected = ref<{ userId: number; username: string }[]>([]);
const showResult = ref(false);
const showReplay = ref(false);
const rematchBusy = ref(false);
const rematchInvite = ref<string | null>(null);
const lastMove = ref<(string | null)[] | null>(null);
const boardRef = ref<InstanceType<typeof MultiBoard> | null>(null);
const topbarRef = ref<HTMLElement | null>(null);
let autoScrolled = false;

function scrollToBoardTop(): void {
  if (autoScrolled || typeof window === 'undefined') return;
  autoScrolled = true;
  void nextTick(() => {
    setTimeout(() => {
      const el = topbarRef.value;
      if (el) {
        const y = el.getBoundingClientRect().top + window.scrollY - 6;
        if (y > 4) {
          window.scrollTo({ top: y, behavior: 'smooth' });
        }
      }
    }, 60);
  });
}

const myId = computed(() => auth.user?.id ?? 0);
const canViewArchive = computed(() => !!auth.user && !auth.user.isGuest);
const isParticipant = computed(
  () => state.value?.participants.some((p) => p.userId === myId.value) ?? false,
);
const myParticipant = computed(
  () => state.value?.participants.find((p) => p.userId === myId.value) ?? null,
);

const multiMode = computed<MultiMode>(() =>
  state.value?.mode === 'three-player' ? 'three-player' : 'four-player',
);
const topology = computed(() => getTopology(multiMode.value));

const viewerSeat = computed<number>(() => {
  const p = myParticipant.value;
  if (!p) return 0;
  return p.seat ?? p.boardIndex ?? 0;
});

const mySeatStatus = computed<SeatStatus>(() => {
  const seat = viewerSeat.value;
  return state.value?.multi?.snapshot.status?.[seat] ?? 'active';
});

const myTurn = computed<boolean>(() => {
  const st = state.value;
  if (!st || st.status !== 'active' || st.savingResult) return false;
  if (!isParticipant.value) return false;
  return st.multi?.snapshot.turn === viewerSeat.value && mySeatStatus.value === 'active';
});

const dests = computed<Record<string, string[]>>(() => {
  const st = state.value;
  if (!st || st.status !== 'active' || !myTurn.value) return {};
  if (st.multi?.legalMoves && Object.keys(st.multi.legalMoves).length > 0) {
    return st.multi.legalMoves;
  }
  try {
    const engine = st.multi
      ? MultiChess.fromSnapshot(st.multi.snapshot)
      : new MultiChess(multiMode.value);
    return engine.legalMovesRecord(viewerSeat.value);
  } catch {
    return {};
  }
});

const checkedKingSquares = computed<string[]>(() => {
  return state.value?.multi?.checkedKingSquares ?? [];
});

const movesSanHistory = computed<string[]>(() => {
  const log = state.value?.multi?.snapshot.moveLog ?? [];
  return log.map((item) => {
    const pieceChar = item.role === 'p' ? '' : item.role.toUpperCase();
    const sep = item.captured ? 'x' : '–';
    const checkSuffix = item.checkedSeats?.length ? '+' : '';
    return `${pieceChar}${item.from}${sep}${item.to}${checkSuffix}`;
  });
});

// ---------- Clocks ----------
const localRemainingMs = ref<number[]>([0, 0, 0, 0]);
const nowTs = ref(Date.now());
let ticker: number | undefined;
let lastTickAt = Date.now();

const firstMoveSec = computed(() => {
  if (!state.value || state.value.status !== 'active' || state.value.moveNumber > 0) return null;
  const elapsed = nowTs.value - (state.value.startedAt || nowTs.value);
  return Math.max(0, Math.ceil((30_000 - elapsed) / 1000));
});

function rebuildLocalClocks(): void {
  const mc = state.value?.multi;
  if (mc && Array.isArray(mc.clocksMs)) {
    localRemainingMs.value = [...mc.clocksMs];
  }
  lastTickAt = Date.now();
  nowTs.value = lastTickAt;
}

watch(() => state.value?.multi?.clocksMs, rebuildLocalClocks, { deep: true });

function tickClocks(): void {
  const now = Date.now();
  nowTs.value = now;
  const elapsed = now - lastTickAt;
  lastTickAt = now;
  const st = state.value;
  if (!st || st.status !== 'active') return;
  const activeSeat = st.multi?.clockActiveSeat ?? null;
  if (activeSeat === null || activeSeat === undefined) return;
  if (localRemainingMs.value[activeSeat] !== undefined) {
    localRemainingMs.value[activeSeat] = Math.max(0, localRemainingMs.value[activeSeat]! - elapsed);
  }
}

function fmtClock(ms: number | undefined | null): string {
  if (ms === null || ms === undefined) return '—';
  const s = Math.max(0, Math.ceil(ms / 100) / 10);
  if (ms < 20_000) return s.toFixed(1);
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

// ---------- Seats & Corner Placement ----------
interface SeatCardView {
  seat: number;
  color: MultiColor;
  position: 'bottom' | 'left' | 'top' | 'right' | 'top-left' | 'top-right';
  participant: GameParticipantInfo | null;
  score: number;
  status: SeatStatus;
  place: number | null;
  isTurn: boolean;
  clockMs: number;
}

const seatCards = computed<SeatCardView[]>(() => {
  const st = state.value;
  if (!st) return [];
  const count = topology.value.seats;
  const colors = SEAT_COLORS[multiMode.value];
  const vSeat = viewerSeat.value;
  const cards: SeatCardView[] = [];
  for (let s = 0; s < count; s++) {
    const rel = (s - vSeat + count) % count;
    let position: SeatCardView['position'] = 'bottom';
    if (count === 4) {
      if (rel === 0) position = 'bottom';
      else if (rel === 1) position = 'left';
      else if (rel === 2) position = 'top';
      else position = 'right';
    } else {
      if (rel === 0) position = 'bottom';
      else if (rel === 1) position = 'top-left';
      else position = 'top-right';
    }
    const participant =
      st.participants.find((p) => (p.seat ?? p.boardIndex) === s) ?? null;
    const color = colors[s] ?? 'red';
    const score = st.multi?.snapshot.scores?.[s] ?? participant?.score ?? 0;
    const status = (st.multi?.snapshot.status?.[s] ?? participant?.outcome ?? 'active') as SeatStatus;
    const place = participant?.place ?? null;
    const isTurn = st.status === 'active' && st.multi?.snapshot.turn === s && status === 'active';
    const clockMs = localRemainingMs.value[s] ?? st.multi?.clocksMs?.[s] ?? 0;
    cards.push({
      seat: s,
      color,
      position,
      participant,
      score,
      status,
      place,
      isTurn,
      clockMs,
    });
  }
  return cards;
});

function colorName(c: MultiColor): string {
  const en = i18n.locale === 'en';
  switch (c) {
    case 'red':
      return en ? 'Red' : 'Красные';
    case 'blue':
      return en ? 'Blue' : 'Синие';
    case 'yellow':
      return en ? 'Yellow' : 'Жёлтые';
    case 'green':
      return en ? 'Green' : 'Зелёные';
  }
}

function statusLabel(st: SeatStatus, isTurn: boolean): string {
  const en = i18n.locale === 'en';
  if (st === 'active') return isTurn ? (en ? 'Turn' : 'Ходит') : '';
  if (st === 'checkmated') return en ? 'Checkmated' : 'Мат';
  if (st === 'stalemated') return en ? 'Stalemated' : 'Пат';
  if (st === 'resigned') return en ? 'Resigned' : 'Сдался';
  if (st === 'timeout') return en ? 'Time out' : 'Время';
  return st;
}

function displayName(p: GameParticipantInfo | null): string {
  if (!p) return '—';
  if (!p.isBot) return p.username;
  const perso = getBotPersonality(p.username);
  const badge = (i18n.locale === 'en' && perso?.badgeEn) || perso?.badge;
  const botWord = i18n.locale === 'en' ? 'Bot' : 'Бот';
  return badge ? `${botWord} · ${badge}` : botWord;
}

// ---------- Actions ----------
function onBoardMove(payload: { from: string; to: string }): void {
  if (!socket.connected) {
    error.value =
      i18n.locale === 'en'
        ? 'Connection lost. Wait for reconnection.'
        : 'Связь потеряна. Дождитесь подключения.';
    boardRef.value?.resetView();
    return;
  }
  socket
    .timeout(8000)
    .emit(
      'game:multi-move',
      { gameId, from: payload.from, to: payload.to },
      (timeout, ack) => {
        if (timeout || !ack) {
          error.value =
            i18n.locale === 'en'
              ? 'Move confirmation missing. Synchronizing…'
              : 'Нет подтверждения хода. Восстанавливаем позицию…';
          boardRef.value?.resetView();
          socket.emit('game:watch', gameId);
          return;
        }
        if (!ack.ok) {
          error.value = ack.error ?? '';
          setTimeout(() => (error.value = ''), 2500);
          boardRef.value?.resetView();
          socket.emit('game:watch', gameId);
        }
      },
    );
}

const resignPending = ref(false);
let resignTimer: ReturnType<typeof setTimeout> | undefined;
function resign(): void {
  if (!resignPending.value) {
    resignPending.value = true;
    resignTimer = setTimeout(() => {
      resignPending.value = false;
    }, 3000);
    return;
  }
  clearTimeout(resignTimer);
  resignPending.value = false;
  socket.emit('game:resign', gameId);
}

function sendChat(text: string): void {
  const t = text.trim();
  if (!t) return;
  socket.emit('game:chat', gameId, t);
}

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

function resultHeadline(): string {
  const st = state.value;
  if (!st || st.status === 'active') return '';
  const en = i18n.locale === 'en';
  if (st.status === 'abandoned' || st.reason === 'abandoned') {
    return en ? 'Game abandoned' : 'Партия отменена';
  }
  const winner = st.participants.find((p) => p.place === 1);
  if (winner) {
    const pts = winner.score ?? 0;
    return en
      ? `Winner: ${winner.username} (${pts} pts)`
      : `Победитель: ${winner.username} (${pts} очк.)`;
  }
  return en ? 'Game finished' : 'Партия завершена';
}

// ---------- SEO ----------
const pageTitle = computed(() => {
  const id = route.params.id;
  const en = i18n.locale === 'en';
  if (!state.value) return `${en ? 'Match' : 'Партия'} #${id} | ${i18n.t.nav.brand}`;
  const mode = modeLabel(state.value.mode, i18n.locale);
  const names = state.value.participants.map((p) => p.username).filter(Boolean).join(' vs ');
  if (names) {
    return `${en ? 'Match' : 'Партия'} #${id} (${mode}): ${names} | ${i18n.t.nav.brand}`;
  }
  return `${en ? 'Match' : 'Партия'} #${id} (${mode}) | ${i18n.t.nav.brand}`;
});

const pageOgDescription = computed(() => {
  const id = route.params.id;
  const en = i18n.locale === 'en';
  if (!state.value) {
    return en ? `Online match #${id} view on Kaissa chess club.` : `Онлайн-просмотр партии #${id} на платформе Каисса.`;
  }
  const mode = modeLabel(state.value.mode, i18n.locale);
  const tc = timeControlLabel(state.value.timeControl);
  const names = state.value.participants.map((p) => p.username).filter(Boolean).join(' vs ');
  const statusText =
    state.value.status === 'active'
      ? (en ? 'Free-For-All game in progress' : 'Партия в игре (каждый за себя)')
      : resultHeadline() || (en ? 'Game finished' : 'Партия завершена');
  return en
    ? `Match #${id} [${mode}, ${tc}]: ${names}. ${statusText}. Watch online on Kaissa.`
    : `Партия #${id} [${mode}, ${tc}]: ${names}. ${statusText}. Смотрите онлайн на платформе Каисса.`;
});

usePageSeo({
  title: pageTitle,
  description: pageOgDescription,
  ogTitle: pageTitle,
  ogDescription: pageOgDescription,
  canonical: computed(() => `/game/${route.params.id}`),
  ogImage: 'https://duochess.ru/og-image.png',
  twitterCard: 'summary_large_image',
});

// ---------- Socket Lifecycle ----------
let offResync: (() => void) | null = null;
let watchRetryTimer: number | undefined;
let prevMoveNumber = -1;

function hydrateFromState(st: GameState): void {
  const isNewMove = prevMoveNumber >= 0 && st.moveNumber > prevMoveNumber;
  prevMoveNumber = st.moveNumber;
  state.value = st;
  error.value = '';
  if (st.chat && Array.isArray(st.chat) && chat.value.length === 0) {
    chat.value = [...st.chat];
  }
  const lm = st.multi?.snapshot.lastMove;
  if (lm) {
    lastMove.value = [lm.from, lm.to];
    if (isNewMove) {
      const lastLog = st.multi?.snapshot.moveLog.at(-1);
      if (lastLog?.seat === viewerSeat.value) {
        trackGoal('game_first_move', { mode: st.mode }, String(gameId));
      }
      if (lastLog?.checkedSeats?.length) {
        playCheckSound();
      } else if (lastLog?.captured) {
        playCaptureSound();
      } else {
        playMoveSound();
      }
    }
  }
  if (st.status !== 'active') showResult.value = true;
  rebuildLocalClocks();
  scrollToBoardTop();
}

function requestWatch(retries = 3): void {
  socket.emit('game:watch', gameId);
  if (retries > 0 && !state.value) {
    clearTimeout(watchRetryTimer);
    watchRetryTimer = window.setTimeout(() => {
      if (!state.value) requestWatch(retries - 1);
    }, 700);
  }
}

onMounted(() => {
  if (props.initialState) {
    hydrateFromState(props.initialState);
  }

  socket.on('game:unavailable', (payload) => {
    if (payload.gameId === gameId) {
      clearTimeout(watchRetryTimer);
      error.value = i18n.locale === 'en' ? 'Game not found' : payload.error;
    }
  });

  socket.on('game:state', (st) => {
    if (st.gameId !== gameId) return;
    clearTimeout(watchRetryTimer);
    hydrateFromState(st);
  });

  socket.on('game:end', (payload) => {
    if (payload.gameId !== gameId) return;
    if (isParticipant.value) {
      trackGoal(
        'game_finished',
        { mode: state.value?.mode ?? 'four-player', reason: payload.reason ?? 'unknown' },
        String(gameId),
      );
    }
    if (state.value) {
      applyEndUpdate(state.value, payload);
      rebuildLocalClocks();
      void auth.check();
      showResult.value = true;
    }
    const myPlace = payload.participants.find((p) => p.userId === myId.value)?.place;
    playGameEndSound(myPlace === 1);
  });

  socket.on('game:chat', (msg) => {
    if (msg.gameId !== gameId) return;
    chat.value.push(msg);
  });

  socket.on('game:players-left', (payload) => {
    if (payload.gameId !== gameId) return;
    disconnected.value = payload.left;
  });

  socket.on('game:rematch', (payload) => {
    if (payload.gameId !== gameId || !isParticipant.value) return;
    rematchInvite.value = payload.lobbyId;
  });

  if (!state.value) {
    api
      .get<{ state: GameState }>(`/api/games/${gameId}/state`)
      .then((res) => {
        if (res.state && !state.value) hydrateFromState(res.state);
      })
      .catch(() => {});
  }

  requestWatch(3);
  offResync = onSocketResync(() => requestWatch(2));
  lastTickAt = Date.now();
  ticker = window.setInterval(tickClocks, 100);
});

onBeforeUnmount(() => {
  clearTimeout(resignTimer);
  clearTimeout(watchRetryTimer);
  socket.emit('game:leave', gameId);
  offResync?.();
  offResync = null;
  socket.off('game:unavailable');
  socket.off('game:state');
  socket.off('game:end');
  socket.off('game:chat');
  socket.off('game:players-left');
  socket.off('game:rematch');
  clearInterval(ticker);
});
</script>

<template>
  <div v-if="state" class="multi-game-page" :class="state.mode">
    <!-- Compact 1-line Header Bar -->
    <header ref="topbarRef" class="multi-topbar panel">
      <div class="topbar-left">
        <router-link to="/" class="back-link">
          <AppIcon name="arrow-left" :size="14" />
          <span>{{ i18n.locale === 'en' ? 'Tables' : 'Столы' }}</span>
        </router-link>
        <strong class="mode-title">{{ modeLabel(state.mode, i18n.locale) }}</strong>
        <span class="badge mono">{{ timeControlLabel(state.timeControl) }}</span>
        <span class="badge">{{ ratingLabel(state, i18n.locale) }}</span>
        <span v-if="state.status === 'active'" class="badge on">
          {{ i18n.locale === 'en' ? 'Live' : 'В игре' }}
        </span>
        <span v-else class="badge">{{ i18n.locale === 'en' ? 'Finished' : 'Завершена' }}</span>
        <span v-if="!isParticipant" class="badge dim">
          {{ i18n.locale === 'en' ? 'Spectating' : 'Зритель' }}
        </span>
        <span
          v-if="state.status === 'active' && firstMoveSec !== null"
          class="badge first-move-chip"
          :class="{ urgent: firstMoveSec <= 10 }"
        >
          ⏱ {{ i18n.locale === 'en' ? `First move: ${firstMoveSec}s` : `Первый ход: ${firstMoveSec} с` }}
        </span>
      </div>

      <div class="topbar-right">
        <span v-if="error" class="inline-error">{{ error }}</span>
        <button
          v-if="canViewArchive && state.status !== 'active'"
          class="small"
          @click="showReplay = true"
        >
          <AppIcon name="play" :size="13" />
          {{ i18n.locale === 'en' ? 'Replay' : 'Реплей' }}
        </button>
        <button
          v-if="state.status !== 'active'"
          class="small ghost"
          @click="showResult = true"
        >
          {{ i18n.locale === 'en' ? 'Standings' : 'Итоги' }}
        </button>
        <button
          v-if="isParticipant && state.status === 'active' && mySeatStatus === 'active'"
          class="danger small"
          @click="resign"
        >
          {{
            resignPending
              ? i18n.locale === 'en'
                ? 'Confirm resign?'
                : 'Подтвердить сдачу?'
              : i18n.t.game.resignBtn
          }}
        </button>
        <button
          v-if="resignPending && state.status === 'active'"
          class="small ghost"
          @click="resignPending = false"
        >
          {{ i18n.locale === 'en' ? 'Cancel' : 'Отмена' }}
        </button>
      </div>
    </header>

    <aside v-if="rematchInvite" class="panel rematch-banner" role="status">
      <span>
        {{
          i18n.locale === 'en'
            ? 'Players are inviting you to a rematch.'
            : 'Участники приглашают вас на реванш.'
        }}
      </span>
      <router-link class="button primary small" :to="`/lobby/${rematchInvite}`">
        {{ i18n.locale === 'en' ? 'Join' : 'Присоединиться' }}
      </router-link>
      <button class="small ghost" @click="rematchInvite = null">
        {{ i18n.locale === 'en' ? 'Dismiss' : 'Скрыть' }}
      </button>
    </aside>

    <!-- Full-Viewport Board Arena -->
    <main class="multi-arena">
      <div class="board-stage" :class="state.mode">
        <!-- Player Cards Positioned in Board Cutouts / Corners -->
        <div
          v-for="card in seatCards"
          :key="card.seat"
          class="seat-card panel"
          :class="[
            `pos-${card.position}`,
            `color-${card.color}`,
            `status-${card.status}`,
            { 'active-turn': card.isTurn, eliminated: card.status !== 'active' },
          ]"
        >
          <div class="seat-card-top">
            <span class="seat-swatch" :class="`swatch-${card.color}`"></span>
            <span class="seat-color-label">{{ colorName(card.color) }}</span>
            <span v-if="card.place" class="place-pill mono">#{{ card.place }}</span>
            <span class="score-pill mono" :title="i18n.locale === 'en' ? 'Points' : 'Очки'">
              {{ card.score }} {{ i18n.locale === 'en' ? 'pts' : 'очк.' }}
            </span>
          </div>

          <div class="seat-card-mid">
            <template v-if="card.participant">
              <BotHoverCard
                v-if="card.participant.isBot"
                :username="card.participant.username"
                :rating="card.participant.ratingBefore"
              >
                <span class="seat-username bot">{{ displayName(card.participant) }}</span>
              </BotHoverCard>
              <span v-else class="seat-username">{{ card.participant.username }}</span>
              <span v-if="!card.participant.isGuest" class="seat-rating mono dim">
                ({{ card.participant.ratingBefore }})
              </span>
              <span v-if="card.participant.userId === myId" class="you-tag">
                {{ i18n.locale === 'en' ? 'You' : 'Вы' }}
              </span>
            </template>
          </div>

          <div class="seat-card-bottom">
            <div
              class="seat-clock mono"
              :class="{ running: card.isTurn, low: card.clockMs < 20_000 && card.status === 'active' }"
            >
              {{ fmtClock(card.clockMs) }}
            </div>
            <span
              v-if="statusLabel(card.status, card.isTurn)"
              class="seat-status-tag"
              :class="{ turn: card.isTurn }"
            >
              {{ statusLabel(card.status, card.isTurn) }}
            </span>
          </div>
        </div>

        <!-- SVG MultiBoard -->
        <MultiBoard
          ref="boardRef"
          :mode="multiMode"
          :snapshot="state.multi?.snapshot ?? null"
          :fen="state.fens[0] ?? null"
          :viewer-seat="viewerSeat"
          :my-turn="myTurn"
          :dests="dests"
          :last-move="lastMove"
          :checked-king-squares="checkedKingSquares"
          @move="onBoardMove"
        />
      </div>
    </main>

    <!-- Right-side Collapsible Chat & Move Log Widget (Closed by Default) -->
    <ChatWidget
      :messages="chat"
      :moves="movesSanHistory"
      :my-user-id="myId"
      @send="sendChat"
    />

    <!-- End-of-game Standings Modal -->
    <div
      v-if="showResult && state.status !== 'active'"
      class="modal-backdrop"
      @click.self="showResult = false"
    >
      <div class="modal result-modal">
        <div class="modal-head">
          <h2>{{ i18n.locale === 'en' ? 'Standings' : 'Итоги партии' }}</h2>
          <button class="modal-close" aria-label="Close" @click="showResult = false">
            <AppIcon name="close" :size="18" />
          </button>
        </div>
        <div class="modal-body">
          <div class="headline-box">
            <h3>{{ resultHeadline() }}</h3>
          </div>
          <MatchCard
            :game="{
              ...state,
              id: state.gameId,
              startedAt: new Date(state.startedAt).toISOString(),
              endedAt: null,
            }"
            :viewer-id="auth.user?.id"
            compact
          />
          <GuestNotice v-if="isParticipant" />
          <div class="modal-actions">
            <button v-if="isParticipant" class="primary" :disabled="rematchBusy" @click="rematch">
              <AppIcon name="rematch" :size="15" />
              {{ i18n.locale === 'en' ? 'Rematch' : 'Реванш' }}
            </button>
            <button v-if="canViewArchive" @click="showResult = false; showReplay = true">
              <AppIcon name="play" :size="14" />
              {{ i18n.locale === 'en' ? 'Replay' : 'Смотреть повтор' }}
            </button>
            <router-link to="/" class="button ghost">
              {{ i18n.locale === 'en' ? 'To Lobby' : 'К столам' }}
            </router-link>
          </div>
        </div>
      </div>
    </div>

    <GameReplayModal v-if="showReplay" :game-id="gameId" @close="showReplay = false" />
  </div>
</template>

<style scoped>
.multi-game-page {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: calc(100dvh - 68px);
  padding: 4px 8px 12px;
}

.multi-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 12px;
  flex-wrap: wrap;
}

.topbar-left,
.topbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  text-decoration: none;
}

.mode-title {
  font-size: 15px;
}

.inline-error {
  color: #f87171;
  font-size: 13px;
}

.multi-arena {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
}

.board-stage {
  position: relative;
  width: min(100vw - 280px, calc(100dvh - 86px));
  height: min(100vw - 280px, calc(100dvh - 86px));
  max-width: 880px;
  max-height: 880px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.seat-card {
  position: absolute;
  z-index: 5;
  width: 184px;
  padding: 7px 10px;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: rgba(20, 24, 31, 0.94);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
  transition: border-color 0.15s ease, opacity 0.15s ease;
}

.seat-card.active-turn {
  border-color: #fbbf24;
  box-shadow: 0 0 0 2px rgba(251, 191, 36, 0.35), 0 8px 20px rgba(0, 0, 0, 0.45);
}

.seat-card.eliminated {
  opacity: 0.58;
  filter: grayscale(0.5);
}

/* 4-player cross board cutout corners — shifted further horizontally away from the board */
.board-stage.four-player .seat-card.pos-bottom {
  right: -76px;
  bottom: 2%;
}
.board-stage.four-player .seat-card.pos-left {
  left: -76px;
  bottom: 2%;
}
.board-stage.four-player .seat-card.pos-top {
  left: -76px;
  top: 2%;
}
.board-stage.four-player .seat-card.pos-right {
  right: -76px;
  top: 2%;
}

/* 3-player hexagonal board corners — shifted further horizontally away from the board */
.board-stage.three-player .seat-card.pos-bottom {
  right: -88px;
  bottom: 2%;
}
.board-stage.three-player .seat-card.pos-top-left {
  left: -88px;
  top: 2%;
}
.board-stage.three-player .seat-card.pos-top-right {
  right: -88px;
  top: 2%;
}

.seat-card-top,
.seat-card-mid,
.seat-card-bottom {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.seat-card-bottom {
  justify-content: space-between;
}

.seat-swatch {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex: none;
}
.swatch-red {
  background: #dc2626;
}
.swatch-blue {
  background: #2563eb;
}
.swatch-yellow {
  background: #eab308;
}
.swatch-green {
  background: #16a34a;
}

.seat-color-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.place-pill {
  font-size: 11px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(251, 191, 36, 0.2);
  color: #fbbf24;
}

.score-pill {
  margin-left: auto;
  font-size: 12px;
  font-weight: 700;
  color: #f8fafc;
}

.seat-username {
  font-size: 13px;
  font-weight: 600;
  max-width: 115px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.seat-rating {
  font-size: 11px;
}

.you-tag {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(59, 130, 246, 0.22);
  color: #93c5fd;
}

.seat-clock {
  font-size: 15px;
  font-weight: 700;
}

.seat-clock.running {
  color: #fbbf24;
}

.seat-clock.low {
  color: #ef4444;
}

.seat-status-tag {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
}

.seat-status-tag.turn {
  background: rgba(251, 191, 36, 0.22);
  color: #fde68a;
  font-weight: 700;
}

.modal-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 12px;
}

@media (max-width: 768px) {
  .board-stage {
    flex-direction: column;
    width: 100%;
    height: auto;
    gap: 8px;
  }

  .seat-card {
    position: static;
    width: 100%;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}
</style>
