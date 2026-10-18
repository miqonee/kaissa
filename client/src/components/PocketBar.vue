<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { DropPieceType, PieceType, Pocket } from 'shared';
import { useI18n } from '../stores/i18n';
const props = defineProps<{ pocket: Pocket; color: 'w' | 'b'; interactive: boolean; selected: PieceType | null; label?: string }>();
const emit = defineEmits<{
  (e: 'select', piece: DropPieceType | null): void;
  (e: 'drag', payload: { piece: DropPieceType; event: MouseEvent | TouchEvent }): void;
}>();
const i18n = useI18n();
const order: DropPieceType[] = ['p', 'n', 'b', 'r', 'q'];
const slots = computed(() => order.map(type => ({ type, count: props.pocket[type] ?? 0 })));
const received = ref<DropPieceType[]>([]);
let flashTimer: ReturnType<typeof setTimeout> | undefined;
watch(() => ({ ...props.pocket }), (now, old) => {
  received.value = order.filter(piece => now[piece] > (old?.[piece] ?? 0));
  if (received.value.length) { clearTimeout(flashTimer); flashTimer = setTimeout(() => { received.value = []; }, 1800); }
});
let cleanupDrag = () => {};
onBeforeUnmount(() => { clearTimeout(flashTimer); cleanupDrag(); });
function select(piece: DropPieceType): void {
  if (props.interactive && props.pocket[piece] > 0) emit('select', props.selected === piece ? null : piece);
}
function drag(piece: DropPieceType, event: PointerEvent): void {
  cleanupDrag();
  if (!props.interactive || props.pocket[piece] <= 0) return;
  if (event.button !== 0) return;
  // A tap selects; only actual movement starts a Chessground drag.
  // Starting the drag on mousedown would select then deselect on click.
  const move = (next: PointerEvent) => {
    if (next.pointerId !== event.pointerId || Math.hypot(next.clientX - event.clientX, next.clientY - event.clientY) < 6) return;
    cleanupDrag();
    emit('drag', { piece, event: next });
  };
  cleanupDrag = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', cleanupDrag);
    window.removeEventListener('pointercancel', cleanupDrag);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', cleanupDrag);
  window.addEventListener('pointercancel', cleanupDrag);
}
</script>

<template>
  <div class="pocket" :class="{ 'black-pocket': color === 'b' }" role="toolbar" :aria-label="label ?? i18n.t.bughouse.yourPocket">
    <button v-for="s in slots" :key="s.type" type="button" class="slot"
      :class="{ 'empty-slot': s.count === 0, draggable: interactive && s.count > 0, 'selected-drop': selected === s.type, received: received.includes(s.type) }"
      :disabled="!interactive || s.count <= 0" :aria-pressed="selected === s.type"
      :aria-label="`${i18n.t.bughouse.pieces[s.type]}: ${s.count}`"
      :title="`${i18n.t.bughouse.pieces[s.type]}: ${s.count}`"
      @click="select(s.type)" @pointerdown="drag(s.type, $event)">
      <img :src="`/pieces/cburnett/${color}${s.type.toUpperCase()}.svg`" :alt="i18n.t.bughouse.pieces[s.type]" width="36" height="36" draggable="false" />
      <span v-if="s.count > 0" class="count mono">{{ s.count }}</span>
    </button>
  </div>
</template>

<style scoped>
.pocket .slot { height: 44px; aspect-ratio: auto; min-width: 0; padding: 0; border: 1px solid transparent; touch-action: none; }
.pocket .slot img { max-width: 36px; max-height: 36px; }
.black-pocket .slot:not(.empty-slot) img { filter: drop-shadow(0 0 1px #ddd) drop-shadow(0 0 1px #ddd); }
.slot:disabled { cursor: default; opacity: 1; }
.slot.empty-slot img { opacity: .2; }
.slot.received { background: var(--accent-soft); box-shadow: inset 0 0 0 2px var(--accent); }
.slot:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
</style>
