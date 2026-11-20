<script setup lang="ts">
import type { Pocket } from 'shared';
import { useI18n } from '../stores/i18n';
import MaterialBalance from './MaterialBalance.vue';
import PocketBar from './PocketBar.vue';

const props = defineProps<{
  fen: string;
  color: 'w' | 'b';
  pockets?: [Pocket, Pocket] | null;
  checkLabel?: string;
}>();
const i18n = useI18n();
</script>

<template>
  <div class="rp-seat">
    <span class="seat-side">
      <i :class="['side-stone', color]" aria-hidden="true" />
      {{ color === 'w' ? (i18n.locale === 'en' ? 'White' : 'Белые') : (i18n.locale === 'en' ? 'Black' : 'Чёрные') }}
    </span>
    <span v-if="checkLabel" class="seat-check">{{ checkLabel }}</span>
    <div class="seat-extras">
      <PocketBar v-if="props.pockets" class="rp-pocket" :pocket="props.pockets[color === 'w' ? 0 : 1]"
        :label="color === 'w' ? (i18n.locale === 'en' ? 'White reserve' : 'Резерв белых') : (i18n.locale === 'en' ? 'Black reserve' : 'Резерв чёрных')"
        :color="color" :interactive="false" :selected="null" />
      <MaterialBalance inline :fen="fen" :color="color" :pockets="pockets ?? undefined" />
    </div>
  </div>
</template>

<style scoped>
.rp-seat { display: flex; align-items: center; gap: 6px; height: 30px; min-width: 0; color: var(--ink-2); font-size: 12px; }
.seat-side, .seat-extras { display: inline-flex; align-items: center; gap: 6px; min-width: 0; }
.seat-side { font-weight: 600; }
.side-stone { width: 9px; height: 9px; border-radius: 50%; background: #faf7ee; border: 1px solid #837968; }
.side-stone.b { background: #25221d; border-color: #968d7d; }
.seat-check { font-size: 11px; font-weight: 600; color: var(--bad); }
.seat-extras { margin-inline-start: auto; }
.rp-pocket { width: auto; padding: 0 3px; gap: 0; grid-template-columns: repeat(5, 24px); background: var(--surface-2); border-radius: var(--r-xs); }
.rp-pocket :deep(.slot) { width: 24px; min-height: 0; height: 24px; border: 0; background: transparent; box-shadow: none; }
.rp-pocket :deep(.slot img) { width: 21px; height: 21px; }
.rp-pocket :deep(.empty-slot) { opacity: .7; }
.rp-pocket :deep(.count) { right: -1px; bottom: 0; font-size: 9px; line-height: 1; padding: 1px; }
@media (max-width: 400px) {
  .rp-pocket { grid-template-columns: repeat(5, 22px); }
  .rp-pocket :deep(.slot) { width: 22px; }
}
</style>
