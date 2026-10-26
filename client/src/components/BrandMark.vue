<script setup lang="ts">
withDefaults(defineProps<{ size?: number; animated?: boolean }>(), {
  size: 26,
  animated: true,
});
</script>
<template>
  <svg
    class="brand-mark"
    :class="{ animated }"
    :width="size"
    :height="size"
    viewBox="12 24 136 136"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <g class="orbit">
      <rect class="tile top-left felt" x="24" y="42" width="46" height="46" rx="12" />
      <rect class="tile top-right gold" x="80" y="42" width="46" height="46" rx="12" />
      <rect class="tile bottom-left gold" x="24" y="98" width="46" height="46" rx="12" />
      <rect class="tile bottom-right felt" x="80" y="98" width="46" height="46" rx="12" />
    </g>
  </svg>
</template>
<style scoped>
.brand-mark {
  --logo-green: var(--felt);
  --logo-gold: var(--accent-2);
  display: block;
  flex: none;
  overflow: visible;
}
[data-theme='dark'] .brand-mark { --logo-green: var(--felt-2); }
.felt { fill: var(--logo-green); }
.gold { fill: var(--logo-gold); }

/* Rotate the tiles together, keeping their colours and sizes intact.
   At each quarter turn, transfer the original (6, -6) corner offset
   to the tile arriving at the screen's top-right. Offsets below are
   in the rotating group's coordinates. All animations share one clock. */
.orbit { transform-origin: 75px 93px; }
.top-right { transform: translate(6px, -6px); }
.animated .orbit,
.animated .tile {
  animation: 8s ease-in-out infinite;
}
.animated .orbit { animation-name: brand-turn; }
.animated .top-left { animation-name: brand-corner-tl; }
.animated .top-right { animation-name: brand-corner-tr; }
.animated .bottom-left { animation-name: brand-corner-bl; }
.animated .bottom-right { animation-name: brand-corner-br; }

@keyframes brand-turn {
  0%, 16% { transform: rotate(0deg); }
  25%, 41% { transform: rotate(90deg); }
  50%, 66% { transform: rotate(180deg); }
  75%, 91% { transform: rotate(270deg); }
  100% { transform: rotate(360deg); }
}
@keyframes brand-corner-tl {
  0%, 16%, 50%, 100% { transform: translate(0, 0); }
  25%, 41% { transform: translate(-6px, -6px); }
}
@keyframes brand-corner-tr {
  0%, 16%, 100% { transform: translate(6px, -6px); }
  25%, 91% { transform: translate(0, 0); }
}
@keyframes brand-corner-bl {
  0%, 41%, 75%, 100% { transform: translate(0, 0); }
  50%, 66% { transform: translate(-6px, 6px); }
}
@keyframes brand-corner-br {
  0%, 66%, 100% { transform: translate(0, 0); }
  75%, 91% { transform: translate(6px, 6px); }
}
@media (prefers-reduced-motion: reduce) {
  .animated .orbit, .animated .tile { animation: none; }
}
</style>
