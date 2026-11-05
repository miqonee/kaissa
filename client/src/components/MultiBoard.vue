<script setup lang="ts">
import { computed, ref } from 'vue';
import type { MPiece, MultiMode, MultiSnapshot } from 'shared';
import { getTopology, MultiChess, SEAT_COLORS } from 'shared';

const props = withDefaults(
  defineProps<{
    mode: MultiMode;
    snapshot?: MultiSnapshot | null;
    fen?: string | null;
    viewerSeat?: number;
    myTurn?: boolean;
    dests?: Record<string, string[]>;
    lastMove?: (string | null)[] | null;
    checkedKingSquares?: string[];
    mini?: boolean;
  }>(),
  {
    snapshot: null,
    fen: null,
    viewerSeat: 0,
    myTurn: false,
    dests: () => ({}),
    lastMove: null,
    checkedKingSquares: () => [],
    mini: false,
  },
);

const emit = defineEmits<{
  (e: 'move', payload: { from: string; to: string }): void;
}>();

const topology = computed(() => getTopology(props.mode));

const rotationDeg = computed(() => {
  const seat = Math.max(0, Math.min(topology.value.seats - 1, props.viewerSeat ?? 0));
  return topology.value.rotationForSeat(seat);
});

const boardMap = computed<Record<string, MPiece>>(() => {
  if (props.snapshot && props.snapshot.board) {
    return props.snapshot.board;
  }
  if (props.fen && props.fen.startsWith('multi:')) {
    const parsed = MultiChess.deserializeBoard(props.fen);
    if (parsed) return parsed.board;
  }
  const initial: Record<string, MPiece> = {};
  for (const [id, p] of Object.entries(topology.value.initialSetup())) {
    initial[id] = {
      role: p.role,
      seat: p.seat,
    };
  }
  return initial;
});

const checkedSquareSet = computed<Set<string>>(() => {
  return new Set(props.checkedKingSquares ?? []);
});

const lastMoveSet = computed<Set<string>>(() => {
  const set = new Set<string>();
  if (props.lastMove) {
    for (const sq of props.lastMove) {
      if (sq) set.add(sq);
    }
  } else if (props.snapshot?.lastMove) {
    set.add(props.snapshot.lastMove.from);
    set.add(props.snapshot.lastMove.to);
  }
  return set;
});

const selectedFrom = ref<string | null>(null);
const dragState = ref<{
  from: string;
  piece: MPiece;
  svgX: number;
  svgY: number;
  moved: boolean;
} | null>(null);

const svgRef = ref<SVGSVGElement | null>(null);

const activeDests = computed<Set<string>>(() => {
  const from = dragState.value?.from ?? selectedFrom.value;
  if (!from || !props.myTurn) return new Set();
  return new Set(props.dests?.[from] ?? []);
});

function canSelectCell(cellId: string): boolean {
  if (props.mini || !props.myTurn) return false;
  const p = boardMap.value[cellId];
  if (!p || p.dead) return false;
  return p.seat === props.viewerSeat && (props.dests?.[cellId]?.length ?? 0) > 0;
}

function pieceHref(p: MPiece): string {
  const colors = SEAT_COLORS[props.mode];
  const prefix = p.dead ? 'dead' : (colors[p.seat] ?? 'red');
  return `/pieces/multi/${prefix}${p.role.toUpperCase()}.svg`;
}

function polygonPoints(poly: [number, number][]): string {
  return poly.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}

function cellSize(cellId: string): number {
  const cell = topology.value.cellById.get(cellId);
  if (!cell) return 54;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of cell.polygon) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return Math.min(maxX - minX, maxY - minY) * 0.82;
}

function clientToBoardPoint(clientX: number, clientY: number): [number, number] | null {
  const svg = svgRef.value;
  if (!svg) return null;
  const rect = svg.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const vs = topology.value.viewSize;
  const half = vs / 2;
  const rawX = ((clientX - rect.left) / rect.width) * vs;
  const rawY = ((clientY - rect.top) / rect.height) * vs;
  const rad = (-rotationDeg.value * Math.PI) / 180;
  const dx = rawX - half;
  const dy = rawY - half;
  const bx = half + dx * Math.cos(rad) - dy * Math.sin(rad);
  const by = half + dx * Math.sin(rad) + dy * Math.cos(rad);
  return [bx, by];
}

function pointInPolygon(pt: [number, number], poly: [number, number][]): boolean {
  const [x, y] = pt;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function findCellAtPoint(pt: [number, number]): string | null {
  for (const c of topology.value.cells) {
    if (pointInPolygon(pt, c.polygon)) return c.id;
  }
  return null;
}

function onCellClick(cellId: string): void {
  if (props.mini || !props.myTurn) return;
  if (selectedFrom.value && activeDests.value.has(cellId)) {
    const from = selectedFrom.value;
    selectedFrom.value = null;
    emit('move', { from, to: cellId });
    return;
  }
  if (canSelectCell(cellId)) {
    selectedFrom.value = selectedFrom.value === cellId ? null : cellId;
  } else {
    selectedFrom.value = null;
  }
}

function onPointerDown(cellId: string, e: PointerEvent): void {
  if (props.mini || !props.myTurn) return;
  if (e.button !== 0) return;
  if (!canSelectCell(cellId)) return;
  const p = boardMap.value[cellId];
  if (!p) return;
  const pt = clientToBoardPoint(e.clientX, e.clientY);
  if (!pt) return;
  (e.currentTarget as Element | null)?.setPointerCapture?.(e.pointerId);
  dragState.value = {
    from: cellId,
    piece: p,
    svgX: pt[0],
    svgY: pt[1],
    moved: false,
  };
}

function onPointerMove(e: PointerEvent): void {
  if (!dragState.value) return;
  const pt = clientToBoardPoint(e.clientX, e.clientY);
  if (!pt) return;
  const cell = topology.value.cellById.get(dragState.value.from);
  if (cell) {
    const dist = Math.hypot(pt[0] - cell.center[0], pt[1] - cell.center[1]);
    if (dist > 10) dragState.value.moved = true;
  }
  dragState.value.svgX = pt[0];
  dragState.value.svgY = pt[1];
}

function onPointerUp(e: PointerEvent): void {
  if (!dragState.value) return;
  const st = dragState.value;
  dragState.value = null;
  if (!st.moved) return;
  const pt = clientToBoardPoint(e.clientX, e.clientY);
  if (!pt) return;
  const target = findCellAtPoint(pt);
  if (target && target !== st.from && (props.dests?.[st.from] ?? []).includes(target)) {
    selectedFrom.value = null;
    emit('move', { from: st.from, to: target });
  } else {
    selectedFrom.value = st.from;
  }
}

function resetView(): void {
  selectedFrom.value = null;
  dragState.value = null;
}

defineExpose({ resetView });
</script>

<template>
  <div class="multi-board-wrap" :class="[mode, { mini, interactive: myTurn && !mini }]">
    <svg
      ref="svgRef"
      class="multi-board-svg"
      :viewBox="`0 0 ${topology.viewSize} ${topology.viewSize}`"
      role="img"
      :aria-label="mode === 'four-player' ? '4-Player Cross Chessboard' : '3-Player Hexagonal Chessboard'"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="dragState = null"
    >
      <defs>
        <radialGradient id="multi-check-grad" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stop-color="#ff3b30" stop-opacity="0.92" />
          <stop offset="65%" stop-color="#dc2626" stop-opacity="0.55" />
          <stop offset="100%" stop-color="#991b1b" stop-opacity="0" />
        </radialGradient>
      </defs>

      <g :transform="`rotate(${rotationDeg} ${topology.viewSize / 2} ${topology.viewSize / 2})`">
        <!-- Cells -->
        <g
          v-for="cell in topology.cells"
          :key="cell.id"
          class="multi-cell"
          :class="{
            light: cell.light,
            dark: !cell.light,
            selected: selectedFrom === cell.id,
            'last-move': lastMoveSet.has(cell.id),
            checked: checkedSquareSet.has(cell.id),
            clickable: canSelectCell(cell.id) || activeDests.has(cell.id),
          }"
          :data-cell="cell.id"
          @click="onCellClick(cell.id)"
          @pointerdown="onPointerDown(cell.id, $event)"
        >
          <polygon :points="polygonPoints(cell.polygon)" class="cell-poly" />

          <!-- Check glow -->
          <circle
            v-if="checkedSquareSet.has(cell.id)"
            :cx="cell.center[0]"
            :cy="cell.center[1]"
            :r="cellSize(cell.id) * 0.62"
            fill="url(#multi-check-grad)"
            pointer-events="none"
          />

          <!-- Piece -->
          <g
            v-if="boardMap[cell.id] && !(dragState?.moved && dragState.from === cell.id)"
            :transform="`rotate(${-rotationDeg} ${cell.center[0]} ${cell.center[1]})`"
            pointer-events="none"
          >
            <image
              :href="pieceHref(boardMap[cell.id]!)"
              :x="cell.center[0] - cellSize(cell.id) / 2"
              :y="cell.center[1] - cellSize(cell.id) / 2"
              :width="cellSize(cell.id)"
              :height="cellSize(cell.id)"
              class="multi-piece-img"
              :class="{ dead: boardMap[cell.id]?.dead }"
            />
          </g>

          <!-- Legal move indicator -->
          <template v-if="!mini && activeDests.has(cell.id)">
            <circle
              v-if="!boardMap[cell.id]"
              :cx="cell.center[0]"
              :cy="cell.center[1]"
              :r="cellSize(cell.id) * 0.19"
              class="dest-dot"
              pointer-events="none"
            />
            <circle
              v-else
              :cx="cell.center[0]"
              :cy="cell.center[1]"
              :r="cellSize(cell.id) * 0.48"
              class="dest-capture-ring"
              pointer-events="none"
            />
          </template>
        </g>

        <!-- Dragged piece overlay -->
        <g
          v-if="dragState && dragState.moved"
          :transform="`rotate(${-rotationDeg} ${dragState.svgX} ${dragState.svgY})`"
          pointer-events="none"
        >
          <image
            :href="pieceHref(dragState.piece)"
            :x="dragState.svgX - cellSize(dragState.from) * 0.56"
            :y="dragState.svgY - cellSize(dragState.from) * 0.56"
            :width="cellSize(dragState.from) * 1.12"
            :height="cellSize(dragState.from) * 1.12"
          />
        </g>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.multi-board-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  aspect-ratio: 1 / 1;
  user-select: none;
  touch-action: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.multi-board-svg {
  width: 100%;
  height: 100%;
  display: block;
  filter: drop-shadow(0 8px 24px rgba(0, 0, 0, 0.35));
}

.multi-cell.light .cell-poly {
  fill: #ebecd0;
  stroke: rgba(20, 24, 30, 0.22);
  stroke-width: 1.1;
}

.multi-cell.dark .cell-poly {
  fill: #779556;
  stroke: rgba(20, 24, 30, 0.28);
  stroke-width: 1.1;
}

.multi-cell.last-move .cell-poly {
  fill: #f5f682 !important;
  fill-opacity: 0.88;
}

.multi-cell.selected .cell-poly {
  fill: #f7ec59 !important;
  stroke: #eab308;
  stroke-width: 2.2;
}

.multi-cell.clickable {
  cursor: pointer;
}

.multi-piece-img.dead {
  opacity: 0.78;
  filter: grayscale(0.95);
}

.dest-dot {
  fill: rgba(20, 28, 36, 0.36);
}

.dest-capture-ring {
  fill: none;
  stroke: rgba(220, 38, 38, 0.65);
  stroke-width: 5.5;
}
</style>
