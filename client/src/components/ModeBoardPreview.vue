<script setup lang="ts">
import { computed } from 'vue';
import { isMultiplayer, modeGuide, type GameMode } from 'shared';
import { useI18n } from '../stores/i18n';
import MultiBoard from './MultiBoard.vue';

const props = defineProps<{ mode: GameMode }>();
const i18n = useI18n();
const guide = computed(() => modeGuide(props.mode, i18n.locale));
const back = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
const cells = Array.from({ length: 64 }, (_, n) => {
  const x = n % 8, y = Math.floor(n / 8);
  const role = y === 0 || y === 7 ? back[x] : y === 1 || y === 6 ? 'P' : null;
  return { x, y, light: (x + y) % 2 === 0, piece: role ? `${y < 2 ? 'b' : 'w'}${role}` : null };
});
</script>

<template>
  <div class="mode-preview" :class="mode" role="img" :aria-label="`${guide.name}: ${guide.board}. ${guide.players}`">
    <MultiBoard :locale="i18n.locale" v-if="isMultiplayer(mode)" :mode="mode" mini aria-hidden="true" />
    <div v-else class="standard-boards" aria-hidden="true">
      <svg v-for="board in (mode === 'bughouse' ? 2 : 1)" :key="board" viewBox="0 0 400 400">
        <g v-for="(cell, index) in cells" :key="index">
          <rect :x="cell.x * 50" :y="cell.y * 50" width="50" height="50" :class="cell.light ? 'light' : 'dark'" />
          <image v-if="cell.piece" :href="`/pieces/cburnett/${cell.piece}.svg`" :x="cell.x * 50 + 3" :y="cell.y * 50 + 3" width="44" height="44" />
        </g>
      </svg>
    </div>
    <div v-if="mode === 'double'" class="preview-legend">
      <span><i class="yellow"></i><i class="red"></i>{{ i18n.locale === 'en' ? 'Team 1' : 'Команда 1' }}</span>
      <span><i class="green"></i><i class="blue"></i>{{ i18n.locale === 'en' ? 'Team 2' : 'Команда 2' }}</span>
    </div>
    <p v-else-if="mode === 'bughouse'" class="preview-note">{{ i18n.locale === 'en' ? 'Captures go to your partner’s board' : 'Взятые фигуры переходят на доску напарника' }}</p>
    <p v-else-if="mode.startsWith('crazyhouse')" class="preview-note">{{ i18n.locale === 'en' ? 'Captured pieces become a reserve for drops' : 'Взятые фигуры — ваш резерв для постановки' }}</p>
  </div>
</template>

<style scoped>
.mode-preview { width: 100%; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 10px; }
.mode-preview :deep(svg) { pointer-events: none; }
.mode-preview :deep(.multi-board-wrap) { width: min(100%, 220px); }
.mode-preview.double :deep(.multi-board-wrap) { width: 100%; }
.standard-boards { display: flex; justify-content: center; gap: 12px; width: 100%; }
.standard-boards svg { width: min(100%, 200px); min-width: 0; aspect-ratio: 1; border-radius: 5px; overflow: hidden; box-shadow: 0 3px 12px #0002; }
.bughouse .standard-boards svg { width: calc(50% - 6px); }
.light { fill: #e8d7b5; } .dark { fill: #829675; }
.preview-note { margin: 0; font-size: 11px; color: var(--ink-2); text-align: center; }
.preview-legend { display: flex; justify-content: center; flex-wrap: wrap; gap: 16px; font-size: 11px; color: var(--ink-2); }
.preview-legend span { display: inline-flex; align-items: center; gap: 4px; }
i { width: 9px; height: 9px; border-radius: 50%; }
.yellow { background: #eab308; } .red { background: #dc2626; } .green { background: #16a34a; } .blue { background: #2563eb; }
</style>
