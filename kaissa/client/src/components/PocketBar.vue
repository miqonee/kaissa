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

const slots = computed(() =>
  ORDER.map((t) => ({ type: t, count: props.pocket[t] ?? 0 })),
);

function onSelect(t: PieceType, count: number): void {
  if (!props.interactive || count <= 0) return;
  emit('select', props.selected === t ? null : t);
}
</script>

<template>
  <div class="pocket">
    <div
      v-for="s in slots"
      :key="s.type"
      class="slot"
      :class="{
        'empty-slot': s.count === 0,
        draggable: interactive && s.count > 0,
        'selected-drop': selected === s.type,
      }"
      @click="onSelect(s.type, s.count)"
    >
      <img v-if="s.count > 0" :src="`/pieces/cburnett/${color}${s.type.toUpperCase()}.svg`" :alt="s.type" draggable="false" />
      <span v-if="s.count > 1" class="count mono">{{ s.count }}</span>
    </div>
  </div>
</template>
