<script setup lang="ts">
import { getTopology, SEAT_COLORS, isMultiplayer, normalizedResult, modeLabel as sharedModeLabel, type GameMode, type MultiMode } from 'shared';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import type { GameSummary, MoveRecord } from 'shared';
import { timeControlLabel } from 'shared';
import { useI18n } from '../stores/i18n';
import ChessBoard from './ChessBoard.vue';
import MultiBoard from './MultiBoard.vue';
import ReplaySeat from './ReplaySeat.vue';
import AppIcon from './AppIcon.vue';
import ReplayOpening from './ReplayOpening.vue';
import { useReplayLayout } from '../composables/useReplayLayout';
import { buildMoveRows, buildReplay, type ReplayMoveView } from '../game/replay';
import { matchOutcome, endReason } from '../utils/match';
import {
  playMoveSound,
  playCaptureSound,
  playCheckSound,
  playCastleSound,
  playDropSound,
} from '../audio/sounds';

const i18n = useI18n();
const en = computed(() => i18n.locale === 'en');

const props = withDefaults(
  defineProps<{
    game: GameSummary;
    moves: MoveRecord[];
    /** компактный режим для модалки */
    compact?: boolean;
  }>(),
  { compact: false },
);

const isMulti = computed(() => isMultiplayer(props.game.mode));
const replayAspect = computed(() => {
  if (!isMulti.value) return 1;
  const topology = getTopology(props.game.mode as MultiMode);
  return (topology.viewWidth ?? topology.viewSize) / (topology.viewHeight ?? topology.viewSize);
});
const { replayRoot } = useReplayLayout(replayAspect);
const viewerSeat = ref(0);
const classicFlipped = ref(false);
const perspectiveGroup = useId();
const multiPlayers = computed(() => [...props.game.participants].sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0)));
function playerColor(seat: number | null | undefined): string {
  return isMulti.value ? (SEAT_COLORS[props.game.mode as MultiMode][seat ?? 0] ?? 'currentColor') : 'currentColor';
}
function moverName(mv: ReplayMoveView): string {
  return props.game.participants.find(p => p.userId === mv.userId)?.username ?? (i18n.locale === 'en' ? 'Unknown player' : 'Неизвестный игрок');
}
function moverColor(mv: ReplayMoveView): string {
  return playerColor(props.game.participants.find(p => p.userId === mv.userId)?.seat);
}
watch(() => props.game.id, () => { stop(); cursor.value = total.value; viewerSeat.value = 0; classicFlipped.value = false; });

const SPEEDS = [0.5, 1, 2, 4];
const BASE_DELAY = 900;

const data = computed(() => buildReplay(props.game, props.moves));
const total = computed(() => props.moves.length);

/** индекс кадра: 0 — начальная позиция, i+1 — после i-го хода */
const cursor = ref(total.value);
const playing = ref(false);
const speed = ref(1);
let timer: number | undefined;

// ---------- Навигация ----------

const canPrev = computed(() => cursor.value > 0);
const canNext = computed(() => cursor.value < total.value);

const frame = computed(() => data.value.frames[Math.min(cursor.value, data.value.frames.length - 1)]!);
const boardsCount = computed(() => data.value.boardsCount);

/** индекс активного хода в списке (null — стартовая позиция) */
const activeMoveIndex = computed(() => (cursor.value > 0 ? cursor.value - 1 : null));

function playReplayMove(targetPly: number): void {
  if (targetPly <= 0 || targetPly > data.value.moves.length) return;
  const mv = data.value.moves[targetPly - 1];
  const targetFrame = data.value.frames[targetPly];
  if (!mv || !targetFrame) return;

  const isCheck = targetFrame.boards.some((b) => b.check !== null) || mv.san.includes('+');
  if (isCheck) {
    playCheckSound();
  } else if (mv.dropPiece) {
    playDropSound();
  } else if (mv.san.includes('O-O')) {
    playCastleSound();
  } else if (mv.san.includes('x')) {
    playCaptureSound();
  } else {
    playMoveSound();
  }
}

function goTo(ply: number, withSound: boolean = false): void {
  const target = Math.max(0, Math.min(total.value, ply));
  if (withSound && target > cursor.value) {
    playReplayMove(target);
  }
  cursor.value = target;
}
function seek(ply: number, withSound = false): void {
  stop();
  goTo(ply, withSound);
}
function first(): void {
  seek(0);
}
function prev(): void {
  seek(cursor.value - 1);
}
function next(): void {
  seek(cursor.value + 1, true);
}
function last(): void {
  seek(total.value);
}
function stepToMove(index: number): void {
  seek(index + 1, true);
}

// ---------- Автоплей ----------

function stop(): void {
  playing.value = false;
  clearInterval(timer);
  timer = undefined;
}

function play(): void {
  if (total.value === 0) return;
  if (cursor.value >= total.value) goTo(0);
  playing.value = true;
  clearInterval(timer);
  timer = window.setInterval(() => {
    if (cursor.value >= total.value) {
      stop();
      return;
    }
    goTo(cursor.value + 1, true);
    if (cursor.value === total.value) stop();
  }, BASE_DELAY / speed.value);
}

function togglePlay(): void {
  playing.value ? stop() : play();
}

watch(speed, () => {
  if (playing.value) play();
});

watch(total, (n) => {
  if (cursor.value > n) cursor.value = n;
});

// ---------- Клавиатура ----------

function onKey(e: KeyboardEvent): void {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
  const t = e.target instanceof HTMLElement ? e.target : null;
  // Native inputs keep their arrow keys. Buttons keep Space for normal activation,
  // but arrow navigation should work immediately after opening (Close has focus).
  if (t?.closest('input, textarea, select, [role="combobox"], [contenteditable="true"]') ||
      (e.key === ' ' && t?.closest('button, a, summary'))) return;
  switch (e.key) {
    case 'ArrowLeft':
      e.preventDefault();
      prev();
      break;
    case 'ArrowRight':
      e.preventDefault();
      next();
      break;
    case ' ':
      e.preventDefault();
      togglePlay();
      break;
    case 'Home':
      e.preventDefault();
      first();
      break;
    case 'End':
      e.preventDefault();
      last();
      break;
  }
}

onMounted(() => document.addEventListener('keydown', onKey));
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey);
  clearInterval(timer);
});

// ---------- Отображение ----------

function modeLabel(m: GameMode): string { return sharedModeLabel(m, i18n.locale); }

function orientationOf(b: number): 'white' | 'black' {
  // как в живой игре: доска 1 — белые снизу, доска 2 — чёрные снизу
  return b === 0 && !(props.game.mode === 'team' && classicFlipped.value) ? 'white' : 'black';
}

/** цвет нижнего игрока доски */
function bottomColorOf(b: number): 'w' | 'b' {
  return orientationOf(b) === 'white' ? 'w' : 'b';
}

function checkOf(b: number): string | null {
  return frame.value.boards[b]?.check ?? null;
}

function lastMoveOf(b: number): [string | null, string | null] | null {
  const lm = frame.value.boards[b]?.lastMove;
  return lm && (lm[0] || lm[1]) ? lm : null;
}

function fenOf(b: number): string {
  return frame.value.boards[b]?.fen ?? '';
}

const playedMovesSan = computed(() => {
  return data.value.moves
    .slice(0, cursor.value)
    .filter((m) => m.boardIndex === 0)
    .map((m) => m.san);
});

function topColorOf(board: number): 'w' | 'b' { return bottomColorOf(board) === 'w' ? 'b' : 'w'; }
function sideStatus(board: number, side: 'w' | 'b'): string | undefined {
  if (!checkOf(board) || fenOf(board).split(' ')[1] !== side) return;
  const isMate = cursor.value === total.value && props.game.status === 'finished' && props.game.reason === 'checkmate' &&
    (boardsCount.value === 1 || props.game.endBoardIndex === board);
  return isMate ? i18n.t.game.reasonCheckmate : (en.value ? 'Check' : 'Шах');
}

const rowsByBoard = computed(() => {
  const out = [];
  for (let b = 0; b < boardsCount.value; b++) out.push(buildMoveRows(data.value, b as 0 | 1));
  return out;
});

function moveClasses(mv: ReplayMoveView | null): Record<string, boolean> {
  if (!mv) return {};
  return {
    active: mv.index === activeMoveIndex.value,
    drop: !!mv.dropPiece,
  };
}

const teams = computed(() => {
  const g = props.game;
  return {
    t1: g.participants.filter((p) => p.team === 1).map((p) => p.username).join(' / ') || '—',
    t2: g.participants.filter((p) => p.team === 2).map((p) => p.username).join(' / ') || '—',
  };
});

const teamNames = computed(() => props.game.mode === 'bughouse'
  ? [en.value ? 'Team 1' : 'Команда 1', en.value ? 'Team 2' : 'Команда 2']
  : [en.value ? 'White' : 'Белые', en.value ? 'Black' : 'Чёрные']);
const resultText = computed(() => {
  const game = props.game, result = normalizedResult(game);
  const byColor = !isMulti.value && boardsCount.value === 1 && game.status === 'finished';
  const outcome = byColor && result === '1-0' ? i18n.t.game.whiteWon : byColor && result === '0-1' ? i18n.t.game.blackWon : matchOutcome(game, undefined, i18n.locale);
  return [outcome, endReason(game, i18n.locale)].filter(Boolean).join(' · ');
});
const activeMove = computed(() => activeMoveIndex.value === null ? null : data.value.moves[activeMoveIndex.value] ?? null);
const movesList = ref<HTMLElement | null>(null);
// Keep the selected half-move visible without ever scrolling the board/modal away
// on phones (scrollIntoView would scroll every ancestor).
function revealCurrentMove(): void {
  const list = movesList.value;
  if (!list) return;
  const active = list.querySelector<HTMLElement>('[aria-current="step"]');
  if (!active) { list.scrollTop = 0; return; }
  const viewport = list.getBoundingClientRect();
  const item = active.getBoundingClientRect();
  if (item.top < viewport.top + 2) list.scrollTop += item.top - viewport.top - 2;
  else if (item.bottom > viewport.bottom - 2) list.scrollTop += item.bottom - viewport.bottom + 2;
}
watch([activeMoveIndex, () => props.game.id], revealCurrentMove, { flush: 'post' });
onMounted(() => { nextTick(revealCurrentMove); });
// The board measures itself after mount, and resizing the window or opening
// analysis changes how many notation rows fit without moving the cursor.
watch(movesList, (list, _, cleanup) => {
  if (!list || typeof ResizeObserver === 'undefined') return;
  const observer = new ResizeObserver(revealCurrentMove);
  observer.observe(list);
  cleanup(() => observer.disconnect());
}, { flush: 'post' });
</script>

<template>
  <div ref="replayRoot" class="replayer" :class="{ compact, 'double-replay': game.mode === 'double' }">
    <header class="replayer-head">
      <div v-if="isMulti" class="rh-multi-players" role="radiogroup" :aria-label="en ? 'View from' : 'Вид со стороны'">
        <span class="rh-perspective-label" aria-hidden="true">{{ en ? 'View from' : 'Ракурс' }}</span>
        <label v-for="player in multiPlayers" :key="player.userId" class="rh-player" :title="player.username">
          <input v-model="viewerSeat" type="radio" :name="perspectiveGroup" :value="player.seat ?? 0" />
          <span class="rh-player-chip">
            <i class="seat-dot" :style="{ background: playerColor(player.seat) }" aria-hidden="true" />
            <strong class="truncate">{{ player.username }}</strong>
            <small v-if="game.mode === 'double'">{{ en ? 'Team' : 'Команда' }} {{ player.team }}</small>
            <AppIcon class="rh-perspective-check" name="check" :size="12" />
          </span>
        </label>
      </div>
      <div v-else class="rh-matchup">
        <div class="rh-teams">
          <span v-for="(names, side) in [teams.t1, teams.t2]" :key="side" class="rh-team" :title="teamNames[side] + ': ' + names">
            <span class="team-key"><i v-if="game.mode !== 'bughouse'" class="team-stone" :class="{ dark: side }" aria-hidden="true" />{{ teamNames[side] }}</span>
            <strong class="truncate">{{ names }}</strong>
          </span>
        </div>
        <button v-if="game.mode === 'team'" type="button" class="rh-flip"
          :aria-pressed="classicFlipped" :aria-label="en ? 'Flip board' : 'Перевернуть доску'"
          :title="en ? 'Flip board' : 'Перевернуть доску'" @click="classicFlipped = !classicFlipped">
          <AppIcon name="refresh" :size="17" />
        </button>
      </div>
      <div class="rh-meta">
        <span v-if="!compact">{{ modeLabel(game.mode) }} · {{ timeControlLabel(game.timeControl) }}</span>
        <span class="rh-result"><AppIcon :name="game.status === 'active' ? 'clock' : 'flag'" :size="13" />{{ resultText }}</span>
      </div>
    </header>

    <div class="replayer-body">
      <section class="rp-boards" :aria-label="en ? 'Chessboards' : 'Шахматные доски'" :class="{ two: boardsCount === 2 }">
        <div v-for="b in boardsCount" :key="b" class="rp-board-col">
          <span v-if="boardsCount === 2" class="rp-board-head">{{ en ? 'Board' : 'Доска' }} {{ b }}</span>
          <ReplaySeat v-if="!isMulti" :fen="fenOf(b - 1)" :color="topColorOf(b - 1)"
            :pockets="frame.pockets?.[b - 1]" :check-label="sideStatus(b - 1, topColorOf(b - 1))" />

          <p v-if="isMulti && activeMove && !activeMove.ok" class="rp-position-warning" role="status">
            {{ en ? 'Position unavailable for this move. Showing the last saved position.' : 'Позиция этого хода недоступна. Показана последняя сохранённая позиция.' }}
          </p>
          <div class="rp-board-stage" :style="{ aspectRatio: replayAspect }">
            <MultiBoard v-if="isMultiplayer(game.mode)" :locale="i18n.locale" :mode="game.mode as MultiMode" :viewer-seat="viewerSeat"
              :coordinates="true" :fen="fenOf(b - 1)" :last-move="lastMoveOf(b - 1)" />
            <ChessBoard v-else :fen="fenOf(b - 1)" :orientation="orientationOf(b - 1)" :movable-color="null"
              :last-move="lastMoveOf(b - 1)" :check-square="checkOf(b - 1)" :coordinates="true" />
          </div>
          <ReplaySeat v-if="!isMulti" :fen="fenOf(b - 1)" :color="bottomColorOf(b - 1)"
            :pockets="frame.pockets?.[b - 1]" :check-label="sideStatus(b - 1, bottomColorOf(b - 1))" />
        </div>
      </section>

      <aside class="rp-side" :aria-label="en ? 'Move list' : 'Запись партии'">
        <div class="rp-moves-head">
          <h3>{{ en ? 'Moves' : 'Ходы' }}</h3>
          <span class="rp-counter mono">{{ cursor }}<span> / </span>{{ total }}</span>
        </div>
        <div class="rp-current">
          <template v-if="activeMove"><b class="mono">{{ activeMove.san }}</b><span class="current-dot" aria-hidden="true">·</span>
            <span class="truncate" :title="moverName(activeMove)">{{ moverName(activeMove) }}</span></template>
          <span v-else>{{ en ? 'Starting position' : 'Начальная позиция' }}</span>
        </div>
        <div v-if="isMulti" ref="movesList" class="rp-moves rp-multi-moves">
          <button v-for="mv in data.moves" :key="mv.index" type="button" class="rp-move rp-multi-move" :class="moveClasses(mv)"
            :aria-current="mv.index === activeMoveIndex ? 'step' : undefined" @click="stepToMove(mv.index)">
            <span class="rp-move-no mono">{{ mv.ply }}.</span>
            <span class="rp-move-player truncate" :title="moverName(mv)"><i class="seat-dot" :style="{ background: moverColor(mv) }" />{{ moverName(mv) }}</span>
            <b class="mono">{{ mv.san }}</b><span v-if="!mv.ok" :title="en ? 'Position unavailable' : 'Позиция недоступна'">⚠</span>
          </button>
        </div>
        <div v-else ref="movesList" class="rp-moves" :class="{ two: boardsCount === 2 }">
          <div v-for="(rows, b) in rowsByBoard" :key="b" class="rp-move-col">
            <h4 v-if="boardsCount === 2" class="rp-col-title">{{ en ? 'Board' : 'Доска' }} {{ b + 1 }}</h4>
            <div class="rp-move-grid">
              <div v-for="row in rows" :key="row.no" class="rp-move-row">
                <span class="rp-move-no mono">{{ row.no }}.</span>
                <button v-for="(mv, side) in [row.white, row.black]" :key="side" type="button" class="rp-move"
                  :class="moveClasses(mv)" :disabled="!mv" :title="mv ? moverName(mv) : undefined"
                  :aria-label="mv ? (boardsCount === 2 ? (en ? 'Board ' : 'Доска ') + (b + 1) + ', ' : '') + row.no + (side ? '… ' : '. ') + mv.san + ', ' + moverName(mv) : undefined"
                  :aria-current="mv && mv.index === activeMoveIndex ? 'step' : undefined" @click="mv && stepToMove(mv.index)">
                  {{ mv ? mv.san : '·' }}
                </button>
              </div>
            </div>
          </div>
        </div>
        <p v-if="!total" class="rp-empty">{{ en ? 'No moves were played.' : 'В этой партии не было ходов.' }}</p>
        <ReplayOpening v-if="game.mode === 'team'" :fen="fenOf(0)" :san="playedMovesSan" />
      </aside>
    </div>

    <div class="rp-transport" role="group" :aria-label="en ? 'Playback' : 'Воспроизведение'">
      <div class="rp-buttons">
        <button type="button" class="icon-only" :disabled="!canPrev" :title="en ? 'First (Home)' : 'В начало (Home)'" :aria-label="en ? 'First (Home)' : 'В начало (Home)'" @click="first"><AppIcon name="skip-back" :size="14" /></button>
        <button type="button" class="icon-only" :disabled="!canPrev" :title="en ? 'Previous (←)' : 'Назад (←)'" :aria-label="en ? 'Previous (←)' : 'Назад (←)'" @click="prev"><AppIcon name="chevron-left" :size="18" /></button>
        <button type="button" class="brass rp-play" :disabled="!total" @click="togglePlay">
          <AppIcon :name="playing ? 'pause' : 'play'" :size="14" />{{ playing ? (en ? 'Pause' : 'Пауза') : (en ? 'Play' : 'Пуск') }}
        </button>
        <button type="button" class="icon-only" :disabled="!canNext" :title="en ? 'Next (→)' : 'Вперёд (→)'" :aria-label="en ? 'Next (→)' : 'Вперёд (→)'" @click="next"><AppIcon name="chevron-right" :size="18" /></button>
        <button type="button" class="icon-only" :disabled="!canNext" :title="en ? 'Last (End)' : 'В конец (End)'" :aria-label="en ? 'Last (End)' : 'В конец (End)'" @click="last"><AppIcon name="skip-forward" :size="14" /></button>
      </div>
      <input class="rp-range" type="range" min="0" :max="total" step="1" :value="cursor" :disabled="!total"
        :style="{ '--progress': (total ? 100 * cursor / total : 0) + '%' }" :aria-label="en ? 'Game position' : 'Позиция в партии'"
        :aria-valuetext="cursor ? cursor + ' / ' + total : (en ? 'Starting position' : 'Начальная позиция')"
        @input="seek(Number(($event.target as HTMLInputElement).value))" />
      <div class="rp-speeds" role="group" :aria-label="en ? 'Playback speed' : 'Скорость воспроизведения'">
        <button v-for="s in SPEEDS" :key="s" type="button" class="rp-speed" :class="{ active: speed === s }" :aria-pressed="speed === s"
          @click="speed = s">{{ s.toLocaleString(en ? 'en' : 'ru') }}×</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.replayer { height: min(820px, calc(100dvh - 100px)); min-height: 0; min-width: 0; display: flex; flex-direction: column; gap: 10px; }
.replayer-head { display: flex; flex: none; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px 14px; min-width: 0; padding-bottom: 9px; border-bottom: 1px solid var(--line); }
.rh-matchup, .rh-teams, .rh-meta, .rh-result { display: flex; align-items: center; min-width: 0; }
.rh-matchup { gap: 8px; max-width: 100%; }
.rh-teams { gap: 14px; }
.rh-team { display: grid; gap: 2px; min-width: 0; }
.rh-team + .rh-team { border-inline-start: 1px solid var(--line); padding-inline-start: 14px; }
.team-key { display: flex; align-items: center; gap: 4px; color: var(--ink-2); line-height: 1.1; font-size: 11px; }
.team-stone { width: 8px; height: 8px; border: 1px solid #837968; border-radius: 50%; background: #faf7ee; }
.team-stone.dark { background: #25221d; border-color: #968d7d; }
.rh-team strong { font-size: 14px; font-weight: 600; line-height: 1.25; }
.rh-flip { flex: none; width: 34px; height: 34px; padding: 0; color: var(--ink-2); background: transparent; border-color: transparent; }
.rh-flip:hover:not(:disabled), .rh-flip[aria-pressed="true"] { background: var(--surface-inset); border-color: var(--line); color: var(--ink); }
.rh-meta { flex-wrap: wrap; gap: 4px 12px; color: var(--ink-2); font-size: 12px; }
.rh-result { gap: 6px; line-height: 1.35; }
.rh-result .app-icon { color: var(--accent); }

.rh-multi-players { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; min-width: 0; }
.rh-perspective-label { margin-inline-end: 5px; color: var(--ink-2); font-size: 12px; }
.rh-player { position: relative; display: inline-flex; min-width: 0; max-width: 220px; cursor: pointer; font-size: 12px; }
.rh-player input { position: absolute; opacity: 0; width: 1px; height: 1px; margin: 0; }
.rh-player-chip { display: flex; align-items: center; gap: 5px; min-width: 0; min-height: 30px; padding: 3px 7px; border: 1px solid transparent; border-radius: var(--r-s); }
.rh-player input:checked + .rh-player-chip { border-color: var(--line-2); background: var(--surface-inset); }
.rh-player:not(:has(input:checked)):hover .rh-player-chip { background: var(--surface-2); }
.rh-player input:focus-visible + .rh-player-chip { outline: 2px solid var(--accent); outline-offset: 1px; }
.rh-player input:not(:checked) + .rh-player-chip .rh-perspective-check { visibility: hidden; }
.rh-perspective-check { color: var(--accent); }
.rh-player small { flex: none; color: var(--ink-2); }
.seat-dot { display: inline-block; width: 8px; height: 8px; flex: 0 0 8px; border-radius: 50%; }

.replayer-body { display: grid; flex: 1 1 0; min-height: 0; grid-template-columns: minmax(0, 1fr) minmax(220px, 28%); gap: 12px; overflow: hidden; }
.rp-boards { display: grid; grid-template-columns: minmax(0, 1fr); align-content: start; gap: 12px; min-width: 0; min-height: 0; overflow: auto; }
.rp-boards.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.rp-board-col { display: flex; flex-direction: column; align-items: center; min-width: 0; gap: 2px; }
.rp-board-col > * { flex: none; width: min(100%, var(--replay-board-size, 500px)); }
.rp-board-stage { aspect-ratio: 1; }
.rp-board-head { font-size: 12px; font-weight: 600; color: var(--ink-2); }
.rp-position-warning { font-size: 12px; margin: 0; color: var(--warn); }

.rp-side { display: flex; flex-direction: column; min-width: 0; min-height: 0; gap: 6px; overflow-y: auto; padding: 10px 12px; background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--r-m); }
.rp-moves-head, .rp-current { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
.rp-moves-head { justify-content: space-between; }
.rp-moves-head h3 { font: 600 17px/1.25 var(--font-display); }
.rp-counter { font-size: 12px; color: var(--ink-2); }
.rp-counter span, .current-dot { color: var(--ink-3); }
.rp-current { min-height: 22px; font-size: 12px; color: var(--ink-2); border-bottom: 1px solid var(--line); padding-bottom: 6px; }
.rp-current b { color: var(--ink); }
.rp-moves { flex: 1 1 auto; min-height: 48px; overflow: auto; overscroll-behavior: contain; }
.rp-move-col { min-width: 0; }
.rp-col-title { margin: 6px 0 2px; font: 600 12px var(--font-ui); color: var(--ink-2); }
.rp-move-row { display: grid; grid-template-columns: 3ch 1fr 1fr; gap: 3px; align-items: center; min-width: 0; min-height: 27px; padding-inline: 2px; border-radius: var(--r-xs); }
.rp-move-row:nth-child(even) { background: color-mix(in srgb, var(--surface-inset) 55%, transparent); }
.rp-move-no { color: var(--ink-2); font-size: 11px; text-align: end; }
.rp-move { min-width: 0; overflow: hidden; text-overflow: ellipsis; justify-content: flex-start; text-align: start; min-height: 25px; padding: 2px 5px; color: var(--ink); background: transparent; border: 1px solid transparent; border-radius: var(--r-xs); font: 500 12px/1.35 var(--font-mono); }
.rp-move:hover:not(:disabled) { background: var(--surface-inset); border-color: var(--line); }
.rp-move.active { background: var(--accent-soft); border-color: var(--accent); font-weight: 700; }
.rp-move:disabled { background: transparent; opacity: .35; }
.rp-move.drop:not(.active) { color: var(--warn); }
.rp-multi-moves { display: flex; flex-direction: column; gap: 3px; }
.rp-multi-move { flex: none; min-height: 30px; display: flex; align-items: center; gap: 5px; }
.rp-move-player { flex: 1; min-width: 0; text-overflow: ellipsis; }
.rp-move-player i { margin-inline-end: 4px; }
.rp-empty { order: 0; margin: 0; font-size: 13px; color: var(--ink-2); }
.rp-side:has(.rp-empty) .rp-moves { display: none; }
.rp-analysis-card { flex: none; margin-top: auto; }

.rp-transport { flex: none; display: grid; grid-template-columns: auto minmax(60px, 1fr) auto; align-items: center; gap: 18px; padding-top: 7px; border-top: 1px solid var(--line); }
.rp-buttons, .rp-speeds { display: flex; align-items: center; gap: 2px; }
.rp-buttons button { min-height: 32px; }
.rp-buttons .icon-only { width: 30px; min-width: 0; padding-inline: 0; background: transparent; border-color: transparent; }
.rp-buttons .icon-only:hover:not(:disabled) { border-color: var(--line); background: var(--surface-inset); }
.rp-play { width: 77px; padding-inline: 6px; }
.rp-speeds { gap: 0; padding: 2px; border-radius: var(--r-s); background: var(--surface-2); border: 1px solid var(--line); }
.rp-speed { height: 26px; font: 500 12px/1 var(--font-mono); padding: 0 7px; border: 1px solid transparent; border-radius: var(--r-xs); background: transparent; color: var(--ink-2); }
.rp-speed.active { background: var(--surface); border-color: var(--line-2); color: var(--ink); }
input.rp-range { width: 100%; min-width: 0; margin: 0; padding: 0; height: 28px; appearance: none; background: transparent; border: 0; cursor: pointer; }
.rp-range::-webkit-slider-runnable-track { height: 4px; border-radius: 9px; background: linear-gradient(to right, var(--accent-2) var(--progress), var(--line) var(--progress)); }
.rp-range::-moz-range-track { height: 4px; border-radius: 9px; background: var(--line); }
.rp-range::-moz-range-progress { height: 4px; border-radius: 9px; background: var(--accent-2); }
.rp-range::-webkit-slider-thumb { appearance: none; width: 12px; height: 12px; margin-top: -4px; border: 2px solid var(--surface); border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
.rp-range::-moz-range-thumb { width: 10px; height: 10px; border: 2px solid var(--surface); border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
.rp-range:focus-visible, .rp-speed:focus-visible, .rp-move:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.rp-range:disabled { opacity: .45; cursor: default; }

/* The wide board uses the entire dialog width; the single transport and
   chronological record follow it. Never fold the 16×8 board into a sidebar. */
.double-replay { overflow-y: auto; overflow-x: hidden; }
.double-replay .replayer-head { order: 0; }
.double-replay .replayer-body { display: contents; }
.double-replay .rp-boards { order: 1; flex: none; overflow: visible; }
.double-replay .rp-board-stage { width: min(100%, max(480px, calc((min(860px, 100dvh) - 346px) * 1.9))); }
.double-replay .rp-transport { order: 2; }
.double-replay .rp-side { order: 3; flex: none; }
.double-replay .rp-multi-moves { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 245px), 1fr)); align-content: start; flex: none; max-height: 146px; min-height: 0; }
.double-replay .rp-side h3 { font-size: 15px; }
.double-replay .rp-current { min-height: 0; }

@media (max-width: 800px) {
  .replayer-body { grid-template-columns: 1fr; grid-auto-rows: max-content; overflow: auto; align-content: start; }
  .rp-boards { overflow: visible; }
  .rp-side { overflow: visible; height: auto; }
  .rp-moves { flex: none; min-height: 0; max-height: 190px; }
  .rp-analysis-card { margin-top: 2px; }
  /* Use the space actually left below a square board for notation. A long
     history then exposes the selected row without scrolling the board away.
     On a short screen the body can still scroll to a readable minimum panel. */
  .replayer:not(.double-replay) .replayer-body:not(:has(.rp-boards.two)) {
    grid-template-rows: max-content minmax(152px, 1fr); align-content: stretch;
  }
  .replayer:not(.double-replay) .replayer-body:not(:has(.rp-boards.two)) .rp-side { overflow-y: auto; }
  .replayer:not(.double-replay) .replayer-body:not(:has(.rp-boards.two)) .rp-moves { flex: 1 1 65px; min-height: 48px; max-height: none; }
  .rp-moves { overscroll-behavior-y: auto; }
}
@media (max-width: 720px) {
  .replayer { gap: 7px; }
  .replayer-head { padding: 1px 1px 6px; gap: 5px 9px; }
  .rh-meta { font-size: 11px; }
  .rh-teams { gap: 8px; }
  .rh-team + .rh-team { padding-inline-start: 8px; }
  .rh-team strong { font-size: 13px; }
  .rp-boards.two { grid-template-columns: minmax(0, 1fr); }
  .rp-transport { grid-template-columns: 1fr auto; column-gap: 6px; row-gap: 0; padding: 0 3px 2px; }
  .rp-range { grid-column: 1 / -1; grid-row: 1; }
  .rp-buttons { justify-self: start; }
  .rp-speeds { justify-self: end; }
  .rp-buttons button { min-height: 34px; }
  .rp-play { width: 67px; }
  .rp-buttons .icon-only { width: 28px; }
  .rp-speed { height: 29px; padding: 0 5px; }
  .double-replay .rp-board-stage { width: 100%; }
  .double-replay .rp-multi-moves { grid-template-columns: 1fr; max-height: 160px; }
}
@media (max-width: 640px) {
  .rh-multi-players { width: 100%; display: grid; gap: 2px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .rh-perspective-label { grid-column: 1 / -1; font-size: 11px; }
  .rh-player, .rh-player-chip { width: 100%; }
  .rh-player small { display: none; }
  .rh-player-chip { min-height: 30px; }
}
@media (max-width: 360px) {
  .rp-transport { column-gap: 3px; }
  .rp-buttons .icon-only { width: 26px; }
  .rp-play { width: 57px; }
  .rp-speed { padding-inline: 4px; }
}
</style>
