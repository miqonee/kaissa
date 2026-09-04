<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Chessground } from '@lichess-org/chessground';
import type { Api as CgApi, Color as CgColor, Config, Key } from 'chessground-types';
import type { PieceType } from 'shared';

const props = withDefaults(
  defineProps<{
    fen: string;
    orientation?: 'white' | 'black';
    /** разрешённые цвета для перемещения (обычно — свой цвет на этой доске) */
    movableColor?: 'white' | 'black' | 'both' | null;
    coordinates?: boolean;
    mini?: boolean;
    lastMove?: readonly (string | null)[] | null;
    checkSquare?: string | null;
    /** выбранный к дропу тип фигуры (клик по карману) */
    dropPiece?: PieceType | null;
    /** клетки, куда валиден дроп (для подсветки) */
    dropDests?: string[] | null;
    externalDests?: { from: string; dests: string[] } | null;
  }>(),
  {
    orientation: 'white',
    movableColor: null,
    coordinates: true,
    mini: false,
    lastMove: null,
    checkSquare: null,
    dropPiece: null,
    dropDests: null,
    externalDests: null,
  },
);

const emit = defineEmits<{
  (e: 'move', payload: { from: Key; to: Key }): void;
  (e: 'drop', payload: { piece: PieceType; to: Key }): void;
  (e: 'squareClick', square: Key): void;
}>();

const el = ref<HTMLElement | null>(null);
let cg: CgApi | null = null;

function emptySquaresOf(fen: string): Key[] {
  const board = fen.split(' ')[0];
  const ranks = board.split('/');
  const files = 'abcdefgh';
  const out: Key[] = [];
  for (let r = 0; r < 8; r++) {
    const rank = ranks[r] ?? '';
    let x = 0;
    for (const ch of rank) {
      if (/\d/.test(ch)) {
        for (let i = 0; i < parseInt(ch, 10); i++) {
          out.push((files[x] + (8 - r)) as Key);
          x++;
        }
      } else x++;
    }
  }
  return out;
}

function isDropValidTarget(sq: Key): boolean {
  if (!props.dropPiece) return false;
  if (props.dropPiece === 'p' && (sq[1] === '1' || sq[1] === '8')) return false;
  return emptySquaresOf(props.fen).includes(sq);
}

function reconfigure(): void {
  if (!cg) return;
  const movable =
    props.movableColor
      ? {
          free: false,
          color: props.movableColor as CgColor,
          showDests: true,
          dests: computeDests(),
          events: {
            after: (orig: Key, dest: Key) => {
              emit('move', { from: orig, to: dest });
            },
          },
        }
      : { free: false, color: undefined as CgColor | undefined, showDests: false, dests: new Map() };
  cg.set({
    fen: props.fen,
    orientation: props.orientation,
    viewOnly: props.movableColor === null,
    movable: movable as Config['movable'],
    highlight: {
      lastMove: true,
      check: !!props.checkSquare,
    },
    ...(props.checkSquare ? {} : {}),
  });
  if (props.checkSquare) {
    // подсветить шах: фигура короля
    cg.setShapes?.([{ orig: props.checkSquare as Key, brush: 'red' }]);
  }
  if (props.lastMove && props.lastMove.length) {
    const m = props.lastMove.filter(Boolean) as Key[];
    cg.set({ lastMove: m });
  }
}

/** Вычислить допустимые ходы (dests) для movableColor через... */
function computeDests(): Map<Key, Key[]> {
  // Chessground сам не генерирует ходы: передаём через externalDests
  const m = new Map<Key, Key[]>();
  if (props.externalDests) {
    m.set(props.externalDests.from as Key, props.externalDests.dests as Key[]);
  }
  return m;
}

onMounted(() => {
  if (!el.value) return;
  cg = Chessground(el.value, {
    fen: props.fen,
    orientation: props.orientation,
    coordinates: props.coordinates,
    viewOnly: props.movableColor === null,
    movable:
      props.movableColor
        ? {
            free: false,
            color: props.movableColor as CgColor,
            showDests: true,
            dests: computeDests(),
            events: {
              after: (orig: Key, dest: Key) => emit('move', { from: orig, to: dest }),
            },
          }
        : { free: false, color: undefined, showDests: false, dests: new Map() },
    selectable: { enabled: false },
    draggable: { showGhost: true },
    animation: { enabled: !props.mini, duration: 120 },
    highlight: { lastMove: true, check: true },
    events: {
      select: (square: Key | undefined) => {
        if (square === undefined) return;
        // Клик по клетке: если выбрана фигура для дропа и клетка пустая — дроп
        if (props.dropPiece && isDropValidTarget(square)) {
          emit('drop', { piece: props.dropPiece, to: square });
        }
      },
    },
  });
  applyProps();
});

function applyProps(): void {
  if (!cg) return;
  cg.set({ fen: props.fen, orientation: props.orientation });
  if (props.lastMove) {
    const m = props.lastMove.filter(Boolean) as Key[];
    if (m.length) cg.set({ lastMove: m });
  }
}

watch(() => props.fen, applyProps);
watch(() => props.orientation, applyProps);
watch(
  () => [props.movableColor, props.externalDests],
  () => {
    reconfigure();
  },
  { deep: true },
);

onBeforeUnmount(() => {
  cg?.destroy();
  cg = null;
});

defineExpose({
  redraw: () => cg?.redrawAll(),
});
</script>

<template>
  <div class="board-wrap" :class="{ mini: mini }">
    <div ref="el" class="cg-wrap-item"></div>
  </div>
</template>

<style scoped>
.board-wrap {
  width: 100%;
  position: relative;
}

.board-wrap :deep(.cg-wrap) {
  width: 100%;
}

.cg-wrap-item {
  width: 100%;
  aspect-ratio: 1;
  position: relative;
}
</style>

<style>
/* ============ Chessground тема «Каисса» (глобальная) ============ */

.cg-wrap {
  position: relative;
  font-size: 0;
}

.cg-board {
  background-color: #e9d3ab;
  background-image: url('/board/wood.svg');
  background-size: 100% 100%;
  width: 100%;
  height: 100%;
  position: relative;
  top: 0;
  left: 0;
}

/* Клетки: тёплое дерево через встроенный SVG (лицензия MIT, ours) */
.cg-board.squares {
  background: none;
}

.cg-square.last-move {
  background-color: rgba(199, 156, 63, 0.45) !important;
}

.cg-square.move-dest {
  background: radial-gradient(circle, rgba(38, 35, 28, 0.28) 18%, transparent 19%) !important;
}

.cg-square.move-dest:hover {
  background: radial-gradient(circle, rgba(38, 35, 28, 0.36) 18%, transparent 19%) !important;
}

.cg-square.selected {
  background-color: rgba(176, 141, 62, 0.5) !important;
}

.cg-square.check {
  background: radial-gradient(ellipse at center, rgba(163, 51, 39, 0.6) 0%, rgba(163, 51, 39, 0) 60%) !important;
}

/* Фигуры cburnett */
piece {
  position: absolute;
  width: 12.5%;
  height: 12.5%;
  background-size: cover;
  z-index: 2;
}

piece.pawn.white { background-image: url('/pieces/cburnett/wP.svg'); }
piece.pawn.black { background-image: url('/pieces/cburnett/bP.svg'); }
piece.knight.white { background-image: url('/pieces/cburnett/wN.svg'); }
piece.knight.black { background-image: url('/pieces/cburnett/bN.svg'); }
piece.bishop.white { background-image: url('/pieces/cburnett/wB.svg'); }
piece.bishop.black { background-image: url('/pieces/cburnett/bB.svg'); }
piece.rook.white { background-image: url('/pieces/cburnett/wR.svg'); }
piece.rook.black { background-image: url('/pieces/cburnett/bR.svg'); }
piece.queen.white { background-image: url('/pieces/cburnett/wQ.svg'); }
piece.queen.black { background-image: url('/pieces/cburnett/bQ.svg'); }
piece.king.white { background-image: url('/pieces/cburnett/wK.svg'); }
piece.king.black { background-image: url('/pieces/cburnett/bK.svg'); }

/* Координаты */
coords {
  position: absolute;
  display: flex;
  pointer-events: none;
  opacity: 0.85;
  font-family: var(--font-mono);
  font-size: 10px;
  z-index: 4;
}

coords.ranks {
  right: -2px;
  top: 0;
  flex-direction: column;
  align-items: flex-end;
  padding-right: 3px;
  height: 100%;
  width: 12px;
  justify-content: space-around;
}

coords.files {
  bottom: -14px;
  left: 0;
  flex-direction: row;
  width: 100%;
  height: 12px;
  justify-content: space-around;
}

coords span {
  color: #26231c;
  text-shadow: 0 1px 1px rgba(255, 255, 255, 0.6);
}

/* Карман (bughouse) */
.pocket {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
  background: var(--bg-inset);
  border: 1px solid var(--line);
  border-radius: var(--r-s);
  padding: 6px;
  width: 100%;
  box-sizing: border-box;
}

.pocket .slot {
  aspect-ratio: 1;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  cursor: default;
}

.pocket .slot.draggable {
  cursor: grab;
}

.pocket .slot.draggable:hover {
  border-color: var(--brass-strong);
  background: #fdf6e3;
}

.pocket .slot.selected-drop {
  border-color: var(--brass-strong);
  box-shadow: inset 0 0 0 2px var(--brass);
  background: #fdf6e3;
}

.pocket .slot img {
  width: 86%;
  height: 86%;
  pointer-events: none;
}

.pocket .slot .count {
  position: absolute;
  right: 2px;
  bottom: 1px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  color: var(--ink-soft);
  background: rgba(251, 249, 243, 0.85);
  border-radius: 3px;
  padding: 0 3px;
}

.pocket .slot.empty-slot {
  background: transparent;
  border-style: dashed;
}
</style>
