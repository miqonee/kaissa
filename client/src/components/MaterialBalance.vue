<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue';
import type { Pocket } from 'shared';
import { calculateMaterial, MATERIAL_ORDER } from '../utils/material';
import { useI18n } from '../stores/i18n';

const props = defineProps<{ fen: string; color: 'w' | 'b'; pockets?: readonly [Pocket | null, Pocket | null] }>();
const i18n = useI18n();
const open = ref(false);
const trigger = ref<HTMLButtonElement | null>(null);
const details = ref<HTMLElement | null>(null);
const tooltipId = useId();
const position = ref({ left: '12px', top: '0px' });
const balance = computed(() => calculateMaterial(props.fen, props.pockets));
const score = computed(() => balance.value.score * (props.color === 'w' ? 1 : -1));
const pieces = computed(() => MATERIAL_ORDER.flatMap(type =>
  Array.from({ length: balance.value.surplus[props.color][type] }, () => type)));
const groups = computed(() => MATERIAL_ORDER.filter(type => balance.value.surplus[props.color][type] > 0));
const description = computed(() => {
  const prefix = props.color === 'w' ? i18n.t.material.white : i18n.t.material.black;
  const list = groups.value.map(type => `${i18n.t.bughouse.pieces[type]} ×${balance.value.surplus[props.color][type]}`).join(', ');
  return `${prefix}: ${list || i18n.t.material.equal}${score.value > 0 ? `; +${score.value}` : ''}`;
});
watch(() => props.fen, () => { open.value = false; });
watch([open, balance], async ([value]) => {
  if (!value) return;
  await nextTick();
  const rect = trigger.value?.getBoundingClientRect();
  if (!rect || !details.value) return;
  const tooltip = details.value.getBoundingClientRect();
  position.value = {
    left: `${Math.max(12, Math.min(rect.right - tooltip.width, window.innerWidth - tooltip.width - 12))}px`,
    top: `${Math.max(12, Math.min(rect.bottom + 6, window.innerHeight - tooltip.height - 12))}px`,
  };
});
function hover(event: PointerEvent, value: boolean): void {
  if (event.pointerType === 'mouse') open.value = value;
}
function toggle(event: MouseEvent): void {
  open.value = event.detail > 0 && window.matchMedia('(hover: hover)').matches ? true : !open.value;
}
</script>

<template>
  <div class="material-balance" :class="{ expanded: open, 'is-equal': !pieces.length && score <= 0 }"
    @pointerenter="hover($event, true)" @pointerleave="hover($event, false)" @focusout="open = false" @keydown.esc.stop="open = false">
    <button ref="trigger" type="button" class="material-trigger" :aria-label="description" :aria-expanded="open" :aria-describedby="open ? tooltipId : undefined"
      @click="toggle">
      <span class="material-miniatures" aria-hidden="true">
        <img v-for="(type, index) in pieces.slice(0, 3)" :key="index"
          :src="`/pieces/cburnett/${color}${type.toUpperCase()}.svg`" alt="" draggable="false" />
        <span v-if="!pieces.length" class="material-equal">＝</span>
      </span>
      <span v-if="score > 0" class="material-score mono">+{{ score }}</span>
    </button>
    <Teleport to="body">
      <div v-if="open" :id="tooltipId" ref="details" class="material-details" role="tooltip" :style="position">
        <strong>{{ color === 'w' ? i18n.t.material.white : i18n.t.material.black }}</strong>
        <div v-for="type in groups" :key="type" class="material-detail-piece">
          <img :src="`/pieces/cburnett/${color}${type.toUpperCase()}.svg`" alt="" width="22" height="22" />
          <span>{{ i18n.t.bughouse.pieces[type] }}</span><b class="mono">×{{ balance.surplus[color][type] }}</b>
        </div>
        <span v-if="!groups.length">{{ i18n.t.material.equal }}</span>
        <span class="material-explanation">{{ i18n.t.material.description }}</span>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.material-balance { position: relative; flex: 0 0 40px; width: 40px; height: 30px; z-index: 5; }
.material-trigger { width: 100%; height: 30px; display: flex; flex-direction: column; gap: 0; padding: 1px 2px; border: 1px solid var(--line); border-radius: var(--r-s); background: var(--surface-inset); color: var(--ink-2); box-shadow: none; }
.material-trigger:active { transform: none; }
.material-trigger:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.material-miniatures { display: flex; align-items: center; justify-content: center; flex: none; height: 16px; min-width: 0; }
.material-miniatures img { width: 16px; height: 16px; object-fit: contain; filter: drop-shadow(0 0 1px var(--ink-3)); }
.material-miniatures img + img { margin-left: -7px; }
.material-score { flex: none; font-size: 10px; line-height: 10px; font-weight: 700; text-align: center; font-variant-numeric: tabular-nums; color: var(--ink); }
.material-equal { color: var(--ink-3); font-size: 14px; }
.material-balance.is-equal .material-trigger { border-color: transparent; background: transparent; }
.material-details { position: fixed; z-index: 1200; width: 210px; max-width: calc(100vw - 24px); padding: 10px 12px; display: flex; flex-direction: column; gap: 5px; background: var(--surface); color: var(--ink); border: 1px solid var(--line-2); border-radius: var(--r-s); box-shadow: var(--shadow-l); font-size: 12px; font-weight: 400; white-space: normal; pointer-events: none; }
.material-detail-piece { display: flex; align-items: center; gap: 6px; }
.material-detail-piece b { margin-left: auto; }
.material-explanation { color: var(--ink-3); font-size: 11px; line-height: 1.4; border-top: 1px solid var(--line); padding-top: 5px; }
@media (max-width: 640px) {
  .material-balance { flex-basis: 36px; width: 36px; height: 26px; }
  .material-trigger { height: 26px; padding: 0 2px; }
  .material-miniatures { height: 14px; }
  .material-miniatures img { width: 14px; height: 14px; }
  .material-miniatures img + img { margin-left: -7px; }
  .material-score { font-size: 9px; line-height: 9px; }
}
</style>
