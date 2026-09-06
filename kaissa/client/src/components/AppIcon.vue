<script setup lang="ts">
import { computed } from 'vue';
import { FILLED_ICONS, ICON_PATHS, type IconName } from './icons';

/**
 * Инлайн-SVG иконка. Заменяет emoji в интерфейсе: единый стиль,
 * цвет наследуется через currentColor, размер задаётся пропом size.
 */
const props = withDefaults(
  defineProps<{
    name: IconName;
    /** сторона квадрата в px (по умолчанию 16) */
    size?: number | string;
    /** толщина линии */
    strokeWidth?: number;
  }>(),
  { size: 16, strokeWidth: 1.8 },
);

const filled = computed(() => FILLED_ICONS.has(props.name));
const sizePx = computed(() => (typeof props.size === 'number' ? `${props.size}px` : props.size));
</script>

<template>
  <svg
    class="app-icon"
    :width="sizePx"
    :height="sizePx"
    viewBox="0 0 24 24"
    :fill="filled ? 'currentColor' : 'none'"
    :stroke="filled ? 'none' : 'currentColor'"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path v-for="(d, i) in ICON_PATHS[name]" :key="i" :d="d" />
  </svg>
</template>

<style scoped>
.app-icon {
  display: block;
  flex: none;
}
</style>
