<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Chessground } from '@lichess-org/chessground';
import type { Api as CgApi, Color as CgColor, Key } from 'chessground-types';
import type { PieceType } from 'shared';

const props = withDefaults(
  defineProps<{
    fen: string;
    orientation?: 'white' | 'black';
    /** цвет, которым разрешено двигать (null — только просмотр) */
    movableColor?: 'white' | 'black' | null;
    /** легальные ходы: { e2: ['e3','e4'], ... } */
    dests?: Record<string, string[]>;
    coordinates?: boolean;
    mini?: boolean;
    lastMove?: readonly (string | null)[] | null;
    /** клетка короля под шахом */
    checkSquare?: string | null;
    /** выбранная в кармане фигура — клик по пустой клетке сделает дроп */
    dropPiece?: PieceType | null;
  }>(),
  {
    orientation: 'white',
    movableColor: null,
    dests: () => ({}),
    coordinates: true,
    mini: false,
    lastMove: null,
    checkSquare: null,
    dropPiece: null,
  },
);

const emit = defineEmits<{
  (e: 'move', payload: { from: string; to: string }): void;
  (e: 'drop', payload: { piece: PieceType; to: string }): void;
}>();

const el = ref<HTMLElement | null>(null);
let cg: CgApi | null = null;

// ---------- утилиты по FEN ----------

function emptySquares(fen: string): Set<string> {
  const ranks = fen.split(' ')[0].split('/');
  const files = 'abcdefgh';
  const out = new Set<string>();
  for (let r = 0; r < 8; r++) {
    let x = 0;
    for (const ch of ranks[r] ?? '') {
      if (/\d/.test(ch)) {
        for (let i = 0; i < parseInt(ch, 10); i++) out.add(`${files[x++]}${8 - r}`);
      } else x++;
    }
  }
  return out;
}

function canDropOn(sq: string): boolean {
  if (!props.dropPiece) return false;
  if (props.dropPiece === 'p' && (sq[1] === '1' || sq[1] === '8')) return false;
  return emptySquares(props.fen).has(sq);
}

function destsMap(): Map<Key, Key[]> {
  const m = new Map<Key, Key[]>();
  for (const [from, tos] of Object.entries(props.dests)) m.set(from as Key, tos as Key[]);
  return m;
}

function lastMoveKeys(): Key[] | undefined {
  if (!props.lastMove) return undefined;
  const m = props.lastMove.filter((x): x is string => !!x);
  return m.length ? (m as Key[]) : undefined;
}

// ---------- конфигурация ----------

function config() {
  const interactive = props.movableColor !== null;
  return {
    fen: props.fen,
    orientation: props.orientation as CgColor,
    coordinates: props.coordinates,
    viewOnly: !interactive && !props.dropPiece,
    turnColor: (props.fen.split(' ')[1] === 'b' ? 'black' : 'white') as CgColor,
    lastMove: lastMoveKeys(),
    check: props.checkSquare ? true : false,
    movable: {
      free: false,
      color: interactive ? (props.movableColor as CgColor) : undefined,
      showDests: true,
      dests: destsMap(),
      events: {
        after: (orig: Key, dest: Key) => emit('move', { from: orig, to: dest }),
      },
    },
    premovable: { enabled: false },
    draggable: {
      enabled: interactive,
      distance: 3,
      autoDistance: true,
      showGhost: true,
      deleteOnDropOff: false,
    },
    selectable: { enabled: true },
    events: {
      select: (key: Key | undefined) => {
        if (!key) return;
        if (props.dropPiece && canDropOn(key)) {
          emit('drop', { piece: props.dropPiece, to: key });
          cg?.selectSquare(null);
        }
      },
    },
    // Плавное скольжение фигур: 200 мс — чётко читается ход и не затягивается
    animation: { enabled: !props.mini, duration: 200 },
    highlight: { lastMove: true, check: true },
    drawable: { enabled: false, visible: false },
  };
}

onMounted(() => {
  if (!el.value) return;
  cg = Chessground(el.value, config() as never);
});

watch(
  () => props.fen,
  (newFen) => {
    if (!cg) return;
    const turnColor = (newFen.split(' ')[1] === 'b' ? 'black' : 'white') as CgColor;
    const interactive = props.movableColor !== null;
    cg.set({
      fen: newFen,
      turnColor,
      check: props.checkSquare ? true : false,
      lastMove: lastMoveKeys(),
      viewOnly: !interactive && !props.dropPiece,
      movable: {
        color: interactive ? (props.movableColor as CgColor) : undefined,
        dests: destsMap(),
      },
      draggable: {
        enabled: interactive,
      },
    } as never);
  },
);

watch(
  () => [props.movableColor, props.dests, props.dropPiece],
  () => {
    if (!cg) return;
    const interactive = props.movableColor !== null;
    cg.set({
      viewOnly: !interactive && !props.dropPiece,
      movable: {
        color: interactive ? (props.movableColor as CgColor) : undefined,
        dests: destsMap(),
      },
      draggable: {
        enabled: interactive,
      },
    } as never);
  },
  { deep: true },
);

watch(
  () => props.lastMove,
  () => {
    if (!cg) return;
    cg.set({ lastMove: lastMoveKeys() } as never);
  },
  { deep: true },
);

watch(
  () => props.checkSquare,
  (chk) => {
    if (!cg) return;
    cg.set({ check: chk ? true : false } as never);
  },
);

watch(
  () => props.orientation,
  (ori) => {
    if (!cg) return;
    cg.set({ orientation: ori as CgColor } as never);
  },
);

onBeforeUnmount(() => {
  cg?.destroy();
  cg = null;
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

.cg-wrap-item {
  width: 100%;
  aspect-ratio: 1;
}
</style>
