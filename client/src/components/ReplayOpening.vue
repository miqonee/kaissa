<script setup lang="ts">
import { computed } from 'vue';
import { detectOpening } from 'shared';
import { analyzePosition } from '../utils/analysis';
import { useI18n } from '../stores/i18n';
import AppIcon from './AppIcon.vue';

const props = defineProps<{ san: string[]; fen: string }>();
const i18n = useI18n();
const en = computed(() => i18n.locale === 'en');
const opening = computed(() => detectOpening(props.san));
const analysis = computed(() => analyzePosition(props.fen));
const verdict = computed(() => {
  const a = analysis.value;
  if (!en.value) return a.verdictRu;
  if (a.isCheckmate) return a.scoreCp > 0 ? 'Checkmate · White wins' : 'Checkmate · Black wins';
  if (a.isDraw) return 'Drawn position';
  const side = a.scoreCp > 0 ? 'White' : 'Black';
  const strength = Math.abs(a.scoreCp);
  return strength <= 40 ? 'Level position' : strength <= 130 ? side + ' is slightly better' : strength <= 350 ? side + ' is better' : side + ' is winning';
});
const terminal = computed(() => analysis.value.isCheckmate || analysis.value.isDraw);
const theory = computed(() => opening.value.stage !== 'middlegame' && !analysis.value.isEndgame);
</script>

<template>
  <details class="rp-analysis-card">
    <summary :title="en ? 'Opening and position' : 'Дебют и позиция'">
      <AppIcon name="book-open" :size="15" />
      <strong>{{ en ? opening.nameEn : opening.nameRu }}</strong>
      <span class="opening-code mono">{{ opening.eco }}</span>
      <AppIcon class="disclosure" name="chevron-down" :size="14" />
    </summary>
    <div class="position">
      <div class="position-eval"><span>{{ verdict }}</span><b class="mono">{{ analysis.evalText }}</b></div>
      <div class="eval-bar" aria-hidden="true"><i :style="{ width: analysis.evalPercent + '%' }" /></div>
      <p v-if="!en && opening.variationRu" class="variation">{{ opening.variationRu }}</p>
      <p v-if="!terminal && !en">{{ theory ? opening.planRu : analysis.positionPlan.strategicPlanRu }}</p>
      <p v-if="opening.bookMovesSan !== '—'"><span>{{ en ? 'Book line:' : 'Основная линия:' }}</span> <b class="mono">{{ opening.bookMovesSan }}</b></p>
      <p v-if="!terminal && theory && opening.continuations.length"><span>{{ en ? 'Continuations:' : 'Продолжения:' }}</span> <b class="mono">{{ opening.continuations.map(c => c.moveSan).join(' · ') }}</b></p>
    </div>
  </details>
</template>

<style scoped>
.rp-analysis-card { min-width: 0; border-top: 1px solid var(--line); color: var(--ink-2); }
summary { display: flex; align-items: center; gap: 7px; padding: 9px 1px 2px; list-style: none; cursor: pointer; }
summary::-webkit-details-marker { display: none; }
summary strong { flex: 1; font-size: 13px; color: var(--ink); line-height: 1.25; overflow-wrap: anywhere; }
.opening-code { font-size: 11px; color: var(--ink-2); }
.disclosure { color: var(--ink-3); }
details[open] .disclosure { transform: rotate(180deg); }
.position { display: grid; gap: 7px; padding: 7px 0 1px; font-size: 12px; line-height: 1.45; }
.position p { margin: 0; }
.position p span, .variation { color: var(--ink-2); }
.position-eval { display: flex; align-items: baseline; justify-content: space-between; gap: 5px; }
.eval-bar { height: 4px; overflow: hidden; background: #302c26; border: 1px solid var(--line-2); border-radius: 4px; }
.eval-bar i { display: block; height: 100%; background: #fff9ec; }
</style>
