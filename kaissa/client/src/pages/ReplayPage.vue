<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import type { GameSummary, MoveRecord, PieceType } from 'shared';
import { api } from '../api/rest';
import ChessBoard from '../components/ChessBoard.vue';
import PocketBar from '../components/PocketBar.vue';

const route = useRoute();
const gameId = Number(route.params.id);

const game = ref<GameSummary | null>(null);
const moves = ref<MoveRecord[]>([]);
const error = ref('');

/** индекс текущего полухода в объединённой ленте (для team: просто по порядку,
 *  для bughouse: лента одна, ходы смешаны по времени — храним как есть) */
const cursor = ref(0);

/** fens по доскам на позиции cursor */
const fens = computed<string[]>(() => {
  if (!game.value) return [];
  const n = game.value.mode === 'bughouse' ? 2 : 1;
  const out: string[] = [];
  for (let b = 0; b < n; b++) {
    // начальная позиция или последний fenAfter на этой доске до cursor
    let fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    // ходы отсортированы по ply глобально? нет — по доскам отдельно. Собираем по времени:
    for (let i = 0; i < cursor.value; i++) {
      const mv = moves.value[i];
      if (mv.boardIndex === b) fen = mv.fenAfter;
    }
    out.push(fen);
  }
  return out;
});

/** список последних ходов (для отрисовки карманов приближённо — не восстанавливаем) */
const lastMoves = computed(() => {
  const res: (readonly (string | null)[])[] = [];
  for (let b = 0; b < (game.value?.mode === 'bughouse' ? 2 : 1); b++) {
    let lm: (string | null)[] = [null, null];
    for (let i = 0; i < cursor.value; i++) {
      const mv = moves.value[i];
      if (mv.boardIndex === b) {
        lm = mv.dropPiece ? [null, mv.to] : [mv.from, mv.to];
      }
    }
    res.push(lm);
  }
  return res;
});

const canPrev = computed(() => cursor.value > 0);
const canNext = computed(() => cursor.value < moves.value.length);

function prev(): void {
  if (canPrev.value) cursor.value--;
}
function next(): void {
  if (canNext.value) cursor.value++;
}
function first(): void {
  cursor.value = 0;
}
function last(): void {
  cursor.value = moves.value.length;
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'ArrowLeft') prev();
  if (e.key === 'ArrowRight') next();
}

onMounted(async () => {
  document.addEventListener('keydown', onKey);
  try {
    const res = await api.get<{ game: GameSummary; moves: MoveRecord[] }>(`/api/games/${gameId}`);
    game.value = res.game;
    moves.value = res.moves;
    // отсортировать по ply (глобальный порядок ходов)
    moves.value.sort((a, b) => a.ply - b.ply);
    cursor.value = res.moves.length;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Ошибка';
  }
});

function modeLabel(m: string): string {
  return m === 'bughouse' ? 'Багхаус' : '2×2';
}
</script>

<template>
  <div v-if="error" class="empty">{{ error }}</div>
  <div v-else-if="game" class="replay">
    <div class="replay-head">
      <h2>Партия #{{ game.id }} · {{ modeLabel(game.mode) }}</h2>
      <span class="badge">{{ game.status === 'finished' ? game.result : game.status === 'active' ? 'идёт' : 'брошена' }}</span>
    </div>
    <div class="replay-grid">
      <div class="boards">
        <div v-for="(fen, b) in fens" :key="b" class="board-col">
          <ChessBoard :fen="fen" :movable-color="null" :last-move="lastMoves[b]" :coordinates="true" />
        </div>
      </div>
      <aside class="panel moves-panel">
        <div class="panel-head"><h3>Ходы</h3><span class="hint mono">{{ cursor }}/{{ moves.length }}</span></div>
        <div class="panel-body">
          <div class="move-list mono">
            <div
              v-for="(mv, i) in moves"
              :key="i"
              class="move-item"
              :class="{ active: i === cursor - 1 }"
              @click="cursor = i + 1"
            >
              <span class="mv-ply">{{ mv.ply }}.</span>
              <span v-if="mv.dropPiece" class="mv-drop">↑{{ mv.dropPiece.toUpperCase() }}@{{ mv.to }}</span>
              <span v-else>{{ mv.from }}–{{ mv.to }}{{ mv.promotion ? '=' + mv.promotion.toUpperCase() : '' }}</span>
            </div>
          </div>
          <div class="controls">
            <button @click="first" :disabled="!canPrev">⏮</button>
            <button @click="prev" :disabled="!canPrev">←</button>
            <button @click="next" :disabled="!canNext">→</button>
            <button @click="last" :disabled="!canNext">⏭</button>
          </div>
        </div>
      </aside>
    </div>
  </div>
  <div v-else class="empty">Загрузка…</div>
</template>

<style scoped>
.replay-head { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }

.replay-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 20px;
  align-items: start;
}

.boards { display: grid; gap: 16px; grid-template-columns: 1fr; }
.boards:has(.board-col:nth-child(2)) { grid-template-columns: 1fr 1fr; }

.moves-panel { max-height: 560px; display: flex; flex-direction: column; }

.move-list {
  overflow-y: auto;
  max-height: 440px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px 10px;
  font-size: 13px;
}

.move-item {
  padding: 3px 6px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  gap: 6px;
}

.move-item:hover { background: color-mix(in srgb, var(--brass) 10%, transparent); }
.move-item.active { background: color-mix(in srgb, var(--brass) 22%, transparent); font-weight: 600; }

.mv-ply { color: var(--ink-faint); }
.mv-drop { color: var(--warn); }

.controls { display: flex; gap: 8px; margin-top: 12px; }
.controls button { flex: 1; }
</style>
