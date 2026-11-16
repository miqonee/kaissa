<script setup lang="ts">
import { ref } from 'vue';
const props = defineProps<{ href: string; size: number; rotation: number; x: number; y: number; visible: boolean }>();
// Pointer coordinates belong to this tiny overlay, not the whole board render.
const position = ref<[number, number]>([props.x, props.y]);
function setPosition(x: number, y: number): void { position.value = [x, y]; }
defineExpose({ setPosition });
</script>
<template>
  <g class="multi-drag-piece" :visibility="visible ? 'visible' : 'hidden'" :transform="`translate(${position[0]} ${position[1]}) rotate(${-rotation})`" pointer-events="none">
    <image :href="href" :x="-size * 0.56" :y="-size * 0.56" :width="size * 1.12" :height="size * 1.12" />
  </g>
</template>
