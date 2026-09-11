<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { GameSummary, MoveRecord, PieceType, Pocket } from 'shared';
import { detectOpening, timeControlLabel } from 'shared';
import ChessBoard from './ChessBoard.vue';
import PocketBar from './PocketBar.vue';
import AppIcon from './AppIcon.vue';
import { buildMoveRows, buildReplay, type ReplayMoveView } from '../game/replay';
import { analyzePosition } from '../utils/analysis';
import {
  playMoveSound,
  playCaptureSound,
  playCheckSound,
  playCastleSound,
  playDropSound,
} from '../audio/sounds';

const props = withDefaults(
  defineProps<{
    game: GameSummary;
    moves: MoveRecord[];
    /** компактный режим для модалки */
    compact?: boolean;
  }>(),
  { compact: false },
);

const SPEEDS = [
  { label: '0,5×', value: 0.5 },
  { label: '1×', value: 1 },
  { label: '2×', value: 2 },
  { label: '4×', value: 4 },
];
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
function first(): void {
  goTo(0);
}
function prev(): void {
  goTo(cursor.value - 1);
}
function next(): void {
  goTo(cursor.value + 1, true);
}
function last(): void {
  goTo(total.value);
}
function stepToMove(index: number): void {
  goTo(index + 1, true);
  stop();
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
  const t = e.target as HTMLElement | null;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
  switch (e.key) {
    case 'ArrowLeft':
      e.preventDefault();
      stop();
      prev();
      break;
    case 'ArrowRight':
      e.preventDefault();
      stop();
      next();
      break;
    case ' ':
      e.preventDefault();
      togglePlay();
      break;
    case 'Home':
      e.preventDefault();
      stop();
      first();
      break;
    case 'End':
      e.preventDefault();
      stop();
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

function modeLabel(m: string): string {
  return m === 'bughouse' ? 'Багхаус' : 'Матч 2×2';
}

function orientationOf(b: number): 'white' | 'black' {
  // как в живой игре: доска 1 — белые снизу, доска 2 — чёрные снизу
  return b === 0 ? 'white' : 'black';
}

/** цвет нижнего игрока доски */
function bottomColorOf(b: number): 'w' | 'b' {
  return orientationOf(b) === 'white' ? 'w' : 'b';
}

function pocketOf(b: number, color: 'w' | 'b'): Pocket | null {
  const p = frame.value.pockets;
  if (!p || !p[b]) return null;
  return p[b][color === 'w' ? 0 : 1] ?? null;
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

const board0Fen = computed(() => fenOf(0));
const recognizedOpening = computed(() => detectOpening(playedMovesSan.value));
const currentAnalysis = computed(() => analyzePosition(board0Fen.value));

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

const REASONS: Record<string, string> = {
  checkmate: 'мат',
  resign: 'сдача',
  timeout: 'время вышло',
  stalemate: 'пат',
  material: 'недостаток материала',
  abandoned: 'партия брошена',
};

const resultText = computed(() => {
  const g = props.game;
  if (g.status === 'active') return 'партия идёт';
  if (g.status === 'abandoned' || g.result === '*') return 'партия брошена';
  const reason = g.reason ? REASONS[g.reason] ?? g.reason : '';
  return `${g.result === '1-0' ? 'победа белых' : 'победа чёрных'}${reason ? ` · ${reason}` : ''}`;
});

/** имя игрока, сделавшего активный ход */
const activeMover = computed(() => {
  const idx = activeMoveIndex.value;
  if (idx === null) return null;
  const mv = data.value.moves[idx];
  if (!mv) return null;
  return props.game.participants.find((p) => p.userId === mv.userId)?.username ?? null;
});

function pieceLabel(t: PieceType): string {
  const map: Record<PieceType, string> = { p: 'пешка', n: 'конь', b: 'слон', r: 'ладья', q: 'ферзь', k: 'король' };
  return map[t] ?? t;
}
</script>

<template>
  <div class="replayer" :class="{ compact }">
    <!-- Шапка: кто играл и чем кончилось -->
    <div class="replayer-head">
      <div class="rh-teams">
        <span class="color-tag w">белые</span>
        <strong class="truncate">{{ teams.t1 }}</strong>
        <span class="rh-vs">vs</span>
        <span class="color-tag b">чёрные</span>
        <strong class="truncate">{{ teams.t2 }}</strong>
      </div>
      <div class="rh-meta">
        <span class="badge">{{ modeLabel(game.mode) }}</span>
        <span class="badge mono">{{ timeControlLabel(game.timeControl) }}</span>
        <span class="badge" :class="{ on: game.status === 'active' }">{{ resultText }}</span>
      </div>
    </div>

    <div class="replayer-body">
      <!-- Доски -->
      <div class="rp-boards" :class="{ two: boardsCount === 2 }">
        <div v-for="b in boardsCount" :key="b" class="rp-board-col">
          <div class="rp-board-head">
            <span class="rp-board-num mono">Доска {{ b }}</span>
            <span
              class="badge bad rp-check-badge"
              :class="{ visible: Boolean(checkOf(b - 1)) }"
              aria-label="Шах"
            >шах</span>
          </div>

          <PocketBar
            v-if="pocketOf(b - 1, bottomColorOf(b - 1) === 'w' ? 'b' : 'w')"
            class="rp-pocket"
            :pocket="pocketOf(b - 1, bottomColorOf(b - 1) === 'w' ? 'b' : 'w')!"
            :color="bottomColorOf(b - 1) === 'w' ? 'b' : 'w'"
            :interactive="false"
            :selected="null"
          />

          <ChessBoard
            :fen="fenOf(b - 1)"
            :orientation="orientationOf(b - 1)"
            :movable-color="null"
            :last-move="lastMoveOf(b - 1)"
            :check-square="checkOf(b - 1)"
            :coordinates="true"
          />

          <PocketBar
            v-if="pocketOf(b - 1, bottomColorOf(b - 1))"
            class="rp-pocket"
            :pocket="pocketOf(b - 1, bottomColorOf(b - 1))!"
            :color="bottomColorOf(b - 1)"
            :interactive="false"
            :selected="null"
          />
        </div>
      </div>

      <!-- Список ходов -->
      <aside class="rp-side">
        <div class="rp-moves-head">
          <span class="hint mono">{{ cursor }}/{{ total }}</span>
          <span v-if="activeMover" class="hint">ход: {{ activeMover }}</span>
        </div>

        <div class="rp-moves" :class="{ two: boardsCount === 2 }">
          <div v-for="(rows, b) in rowsByBoard" :key="b" class="rp-move-col">
            <div v-if="boardsCount === 2" class="rp-col-title mono">Доска {{ b + 1 }}</div>
            <div class="rp-move-grid">
              <template v-for="row in rows" :key="row.no">
                <span class="rp-move-no mono">{{ row.label }}</span>
                <button
                  class="rp-move"
                  :class="moveClasses(row.white)"
                  :disabled="!row.white"
                  @click="row.white && stepToMove(row.white.index)"
                >
                  {{ row.white ? row.white.san : '—' }}
                </button>
                <button
                  class="rp-move"
                  :class="moveClasses(row.black)"
                  :disabled="!row.black"
                  @click="row.black && stepToMove(row.black.index)"
                >
                  {{ row.black ? row.black.san : '—' }}
                </button>
              </template>
            </div>
          </div>
        </div>

        <p v-if="!total" class="empty tiny">В этой партии не было ходов.</p>

        <!-- Дебют и оценка текущей позиции (для режима 1 доски) -->
        <div v-if="boardsCount === 1" class="rp-analysis-card">
          <div class="rp-an-top">
            <div class="rp-an-title-group">
              <AppIcon name="book-open" :size="13" />
              <strong class="rp-op-name truncate" :title="recognizedOpening.nameRu">
                {{ recognizedOpening.nameRu }}
              </strong>
            </div>
            <div class="rp-an-badges">
              <span class="eco-badge mono">{{ recognizedOpening.eco }}</span>
              <span
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

          <!-- Шкала оценки -->
          <div class="rp-eval-track" :title="`Шансы сторон: белые ${currentAnalysis.evalPercent}% / чёрные ${100 - currentAnalysis.evalPercent}%`">
            <div class="rp-eval-fill white" :style="{ width: `${currentAnalysis.evalPercent}%` }"></div>
            <div class="rp-eval-fill black" :style="{ width: `${100 - currentAnalysis.evalPercent}%` }"></div>
          </div>

          <div class="rp-an-sub">
            <span class="dim tiny">{{ currentAnalysis.verdictRu }}</span>
            <span
              v-if="currentAnalysis.materialDiff !== 0"
              class="rp-mat-pill mono tiny"
              :class="{ 'mat-w': currentAnalysis.materialDiff > 0, 'mat-b': currentAnalysis.materialDiff < 0 }"
            >
              {{ currentAnalysis.materialDiff > 0 ? `Белые +${currentAnalysis.materialDiff}` : `Чёрные +${Math.abs(currentAnalysis.materialDiff)}` }}
            </span>
          </div>

          <p v-if="recognizedOpening.variationRu" class="rp-an-var dim tiny truncate" :title="recognizedOpening.variationRu">
            {{ recognizedOpening.variationRu }}
          </p>

          <details class="rp-details">
            <summary class="dim tiny rp-details-summary">
              План: {{ (recognizedOpening.stage === 'theory' && !currentAnalysis.isEndgame) ? 'дебют' : currentAnalysis.positionPlan.structureNameRu }}
            </summary>
            <div class="rp-details-content">
              <p class="dim tiny rp-plan-text">
                {{ (recognizedOpening.stage === 'theory' && !currentAnalysis.isEndgame) ? recognizedOpening.planRu : currentAnalysis.positionPlan.strategicPlanRu }}
              </p>
              <div v-if="recognizedOpening.continuations?.length && recognizedOpening.stage === 'theory' && !currentAnalysis.isEndgame" class="rp-cont-block">
                <span class="dim tiny label">Теория:</span>
                <div class="rp-cont-chips">
                  <span v-for="c in recognizedOpening.continuations" :key="c.moveSan" class="rp-cont-chip tiny mono">
                    {{ c.moveSan }}
                  </span>
                </div>
              </div>
            </div>
          </details>
        </div>
      </aside>
    </div>

    <!-- Транспорт -->
    <div class="rp-transport">
      <div class="rp-buttons">
        <button class="small ghost icon-only" :disabled="!canPrev" title="В начало (Home)" @click="first">
          <AppIcon name="skip-back" :size="14" />
        </button>
        <button class="small icon-only" :disabled="!canPrev" title="Назад (←)" @click="prev">
          <AppIcon name="chevron-left" :size="16" />
        </button>
        <button class="brass rp-play" :disabled="!total" @click="togglePlay">
          <AppIcon :name="playing ? 'pause' : 'play'" :size="15" />
          {{ playing ? 'Пауза' : 'Смотреть' }}
        </button>
        <button class="small icon-only" :disabled="!canNext" title="Вперёд (→)" @click="next">
          <AppIcon name="chevron-right" :size="16" />
        </button>
        <button class="small ghost icon-only" :disabled="!canNext" title="В конец (End)" @click="last">
          <AppIcon name="skip-forward" :size="14" />
        </button>
      </div>

      <input
        class="rp-range"
        type="range"
        min="0"
        :max="total"
        step="1"
        :value="cursor"
        :disabled="!total"
        aria-label="Позиция в партии"
        @input="goTo(Number(($event.target as HTMLInputElement).value))"
      />

      <div class="rp-speeds">
        <button
          v-for="s in SPEEDS"
          :key="s.value"
          class="rp-speed"
          :class="{ active: speed === s.value }"
          @click="speed = s.value"
        >
          {{ s.label }}
        </button>
      </div>
    </div>

    <p class="rp-hint dim tiny">
      Стрелки ←/→ — ход назад/вперёд, пробел — пуск/пауза, Home/End — начало/конец.
    </p>
  </div>
</template>

<style scoped>
.replayer {
  display: flex;
  flex-direction: column;
  gap: var(--gap-m);
}

/* ---------- Шапка ---------- */
.replayer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gap-m);
  flex-wrap: wrap;
}

.rh-teams {
  display: flex;
  align-items: center;
  gap: var(--gap-xs);
  min-width: 0;
  flex-wrap: wrap;
  font-size: 14px;
}

.rh-teams strong {
  max-width: 190px;
}

.rh-vs {
  color: var(--ink-3);
  font-size: 12px;
  font-style: italic;
  padding: 0 2px;
}

.rh-meta {
  display: flex;
  align-items: center;
  gap: var(--gap-xs);
  flex-wrap: wrap;
}

/* ---------- Тело ---------- */
.replayer-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: var(--gap-m);
  align-items: start;
}

.rp-boards {
  display: grid;
  gap: var(--gap-m);
  grid-template-columns: 1fr;
  min-width: 0;
}

.rp-boards.two {
  grid-template-columns: 1fr 1fr;
}

.rp-board-col {
  display: flex;
  flex-direction: column;
  gap: var(--gap-xs);
  min-width: 0;
}

.rp-board-head {
  display: flex;
  align-items: center;
  gap: var(--gap-xs);
  height: 26px;
  min-height: 26px;
  box-sizing: border-box;
}

.rp-check-badge {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.12s ease;
}

.rp-check-badge.visible {
  opacity: 1;
  pointer-events: auto;
}

.rp-board-num {
  font-size: 13px;
  font-weight: 700;
}

.rp-pocket {
  max-width: 320px;
  align-self: stretch;
}

/* ---------- Список ходов ---------- */
.rp-side {
  display: flex;
  flex-direction: column;
  gap: var(--gap-xs);
  min-width: 0;
}

.rp-moves-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gap-s);
}

.rp-moves {
  display: grid;
  gap: var(--gap-s);
  max-height: 420px;
  overflow-y: auto;
  padding-right: 4px;
}

.rp-move-grid {
  display: grid;
  grid-template-columns: auto 1fr 1fr;
  gap: 2px 6px;
  font-size: 12.5px;
  align-items: center;
}

/* ---------- Компактный режим (модалка) ---------- */
.compact .rp-moves {
  max-height: 220px;
}

/* В модалке компактнее транспорт: меньше отступы и кнопка плеера */
.compact .rp-transport {
  gap: var(--gap-s);
  padding: var(--gap-xs) var(--gap-s);
}

.compact .rp-play {
  min-width: 0;
  padding-inline: 10px;
}

.compact .rp-hint {
  display: none;
}

.rp-col-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ink-3);
  padding: 2px 0;
}

.rp-move-no {
  color: var(--ink-3);
  font-size: 11.5px;
  text-align: right;
  padding-right: 2px;
}

.rp-move {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 12.5px;
  padding: 3px 6px;
  border: 1px solid transparent;
  border-radius: var(--r-xs);
  background: transparent;
  color: var(--ink);
  cursor: pointer;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: background var(--t-fast), border-color var(--t-fast);
}

.rp-move:hover:not(:disabled) {
  background: var(--surface-inset);
}

.rp-move:disabled {
  opacity: 0.35;
  cursor: default;
  transform: none;
}

.rp-move.active {
  background: var(--accent-soft);
  border-color: var(--accent-2);
  color: var(--ink);
  font-weight: 600;
}

.rp-move.drop {
  color: var(--warn);
}

/* ---------- Транспорт ---------- */
.rp-transport {
  display: grid;
  grid-template-columns: auto minmax(120px, 1fr) auto;
  align-items: center;
  gap: var(--gap-m);
  padding: var(--gap-s) var(--gap-m);
  background: var(--surface-inset);
  border: 1px solid var(--line);
  border-radius: var(--r-m);
}

/* Узкий контейнер: скорости переносятся на вторую строку, но транспорт остаётся виден целиком */
@media (max-width: 720px) {
  .rp-transport {
    grid-template-columns: 1fr;
    justify-items: stretch;
  }
}

.rp-buttons {
  display: flex;
  align-items: center;
  gap: var(--gap-xs);
}

.rp-play {
  min-width: 118px;
}

.rp-range {
  width: 100%;
  max-width: 320px;
  margin: 0 auto;
  padding: 0;
  accent-color: var(--accent-2);
}

.rp-range:focus {
  box-shadow: none;
}

.rp-speeds {
  display: flex;
  gap: 2px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-s);
  padding: 2px;
}

.rp-speed {
  border: none;
  background: transparent;
  color: var(--ink-3);
  padding: 3px 8px;
  font-size: 12px;
  border-radius: var(--r-xs);
  font-family: var(--font-mono);
}

.rp-speed:hover {
  background: var(--surface-inset);
  color: var(--ink);
}

.rp-speed.active {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
}

.rp-hint {
  margin: 0;
  text-align: center;
}

/* ---------- Адаптив ---------- */
@media (max-width: 980px) {
  .replayer-body {
    grid-template-columns: 1fr;
  }
  .rp-transport {
    grid-template-columns: 1fr;
    justify-items: stretch;
  }
  .rp-buttons {
    justify-content: center;
  }
  .rp-speeds {
    justify-content: center;
  }
}

@media (max-width: 620px) {
  .rp-boards.two {
    grid-template-columns: 1fr;
  }
}

/* ---------- Анализ и дебют в плеере ---------- */
.rp-analysis-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: var(--r-s);
  padding: 8px 10px;
  margin-top: 4px;
}

.rp-an-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.rp-an-title-group {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  flex: 1;
}

.rp-op-name {
  font-size: 12px;
  color: var(--ink);
}

.rp-an-badges {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.eco-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: var(--r-xs);
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  color: var(--accent);
  border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
}

.eval-pill {
  font-size: 10.5px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: var(--r-xs);
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

.rp-eval-track {
  display: flex;
  height: 4px;
  width: 100%;
  border-radius: 2px;
  overflow: hidden;
  background: var(--surface-3);
}

.rp-eval-fill {
  height: 100%;
  transition: width 0.2s ease-out;
}

.rp-eval-fill.white {
  background: #ffffff;
}

.rp-eval-fill.black {
  background: #2b2b2b;
}

.rp-an-sub {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-size: 11px;
}

.rp-mat-pill {
  font-size: 10px;
  font-weight: 700;
  padding: 0 4px;
  border-radius: 3px;
}

.rp-mat-pill.mat-w {
  background: #ffffff;
  color: #111111;
}

.rp-mat-pill.mat-b {
  background: #222222;
  color: #ffffff;
  border: 1px solid #444444;
}

.rp-an-var {
  font-size: 11px;
  color: var(--accent);
  font-weight: 500;
}

.rp-details {
  margin-top: 2px;
}

.rp-details-summary {
  cursor: pointer;
  list-style: none;
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  font-weight: 600;
}

.rp-details-summary::-webkit-details-marker {
  display: none;
}

.rp-details-summary::before {
  content: '▸ ';
}

.rp-details[open] .rp-details-summary::before {
  content: '▾ ';
}

.rp-details-content {
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rp-plan-text {
  margin: 0;
  font-size: 11px;
  line-height: 1.4;
}

.rp-cont-block {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.rp-cont-chips {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.rp-cont-chip {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: var(--r-xs);
  background: var(--surface-3);
  border: 1px solid var(--line);
  color: var(--accent);
  font-weight: 600;
}
</style>
