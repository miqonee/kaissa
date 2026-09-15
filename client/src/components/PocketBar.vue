<script setup lang="ts">
import { computed } from 'vue';
import type { PieceType, Pocket as PocketType } from 'shared';

const props = defineProps<{
  pocket: PocketType;
  color: 'w' | 'b';
  interactive: boolean;
  selected: PieceType | null;
}>();

const emit = defineEmits<{
  (e: 'select', piece: PieceType | null): void;
}>();

const ORDER: PieceType[] = ['p', 'n', 'b', 'r', 'q'];

const PIECE_NAMES: Record<PieceType, string> = {
  p: 'пешка',
  n: 'конь',
  b: 'слон',
  r: 'ладья',
  q: 'ферзь',
  k: 'король',
};

function pieceAlt(type: PieceType, color: 'w' | 'b'): string {
  const colorPrefix = color === 'w' ? 'Белая' : 'Чёрная';
  const colorPrefixMasc = color === 'w' ? 'Белый' : 'Чёрный';
  if (type === 'n' || type === 'b' || type === 'q' || type === 'k') {
    return `${colorPrefixMasc} ${PIECE_NAMES[type] || 'фигура'}`;
  }
  return `${colorPrefix} ${PIECE_NAMES[type] || 'фигура'}`;
}

const slots = computed(() =>
  ORDER.map((t) => ({ type: t, count: props.pocket[t] ?? 0 })),
);

function onSelect(t: PieceType, count: number): void {
  if (!props.interactive || count <= 0) return;
  emit('select', props.selected === t ? null : t);
}
</script>

<template>
  <div class="pocket" role="toolbar" aria-label="Карман фигур">
    <div
      v-for="s in slots"
      :key="s.type"
      class="slot"
      :class="{
        'empty-slot': s.count === 0,
        draggable: interactive && s.count > 0,
        'selected-drop': selected === s.type,
      }"
      :role="interactive && s.count > 0 ? 'button' : undefined"
      :tabindex="interactive && s.count > 0 ? 0 : undefined"
      :aria-label="s.count > 0 ? `${pieceAlt(s.type, color)}: ${s.count} шт.` : undefined"
      @click="onSelect(s.type, s.count)"
      @keydown.enter.space.prevent="onSelect(s.type, s.count)"
    >
      <img
        v-if="s.count > 0"
        :src="`/pieces/cburnett/${color}${s.type.toUpperCase()}.svg`"
        :alt="pieceAlt(s.type, color)"
        width="40"
        height="40"
        draggable="false"
      />
      <span v-if="s.count > 1" class="count mono">{{ s.count }}</span>
    </div>
  </div>
</template>
