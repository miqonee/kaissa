<script setup lang="ts">
import { computed, useId } from 'vue';
import { MODE_GROUPS, modeGuide, type GameMode } from 'shared';
import { useI18n } from '../stores/i18n';
import ModeBoardPreview from './ModeBoardPreview.vue';
import AppIcon from './AppIcon.vue';

const props = defineProps<{ modelValue: GameMode; disabled?: boolean }>();
const emit = defineEmits<{ (e: 'update:modelValue', mode: GameMode): void }>();
const i18n = useI18n();
const radioName = useId();
const en = computed(() => i18n.locale === 'en');
const selected = computed(() => modeGuide(props.modelValue, i18n.locale));
</script>

<template>
  <div class="mode-picker">
    <fieldset class="mode-list" :disabled="disabled">
      <legend class="sr-only">{{ en ? 'Game mode' : 'Режим игры' }}</legend>
      <div v-for="group in MODE_GROUPS" :key="group.id" class="mode-group">
        <h3>{{ en ? group.en : group.ru }}</h3>
        <div class="mode-group-options">
          <label v-for="mode in group.modes" :key="mode" class="mode-option" :class="{ selected: mode === modelValue }">
            <input type="radio" :name="radioName" :value="mode" :checked="mode === modelValue" @change="emit('update:modelValue', mode)" />
            <span class="mode-option-copy"><strong>{{ modeGuide(mode, i18n.locale).name }}</strong><small>{{ modeGuide(mode, i18n.locale).board }}</small></span>
            <AppIcon v-if="mode === modelValue" name="check" :size="17" />
          </label>
        </div>
      </div>
    </fieldset>
    <section class="mode-detail" aria-live="polite" aria-atomic="true">
      <div class="mode-detail-heading"><h3>{{ selected.name }}</h3><span class="badge">{{ selected.players }}</span></div>
      <ModeBoardPreview :mode="modelValue" />
      <p class="mode-summary">{{ selected.summary }}</p>
      <p class="mode-goal"><AppIcon name="crown" :size="16" /><span>{{ selected.goal }}</span></p>
      <router-link :to="selected.path" class="mode-rule-link"><AppIcon name="book-open" :size="15" />{{ en ? 'Full rules' : 'Полные правила' }}<span aria-hidden="true"> →</span></router-link>
    </section>
  </div>
</template>

<style scoped>
.mode-picker { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(260px, 1fr); gap: 24px; align-items: stretch; }
.mode-list { min-width: 0; margin: 0; padding: 0; border: 0; display: flex; flex-direction: column; gap: 16px; }
.mode-group h3 { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; color: var(--ink-2); margin: 0 0 7px; }
.mode-group-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.mode-option { display: flex; align-items: center; justify-content: space-between; gap: 8px; position: relative; padding: 12px; border: 1px solid var(--line); border-radius: var(--r-m); cursor: pointer; background: var(--surface); transition: border-color .15s, background .15s; min-height: 68px; }
.mode-option:hover { border-color: var(--accent); background: var(--surface-hover); }
.mode-option.selected { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, var(--surface)); box-shadow: 0 0 0 1px var(--accent); }
.mode-option svg { color: var(--accent); flex: none; }
.mode-option-copy { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.mode-option strong { font-size: 13px; font-weight: 650; line-height: 1.3; }
.mode-option small { color: var(--ink-2); font-size: 11px; line-height: 1.4; }
.mode-option input, .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); border: 0; }
.mode-option:has(input:focus-visible) { outline: 2px solid var(--accent); outline-offset: 3px; }
.mode-list:disabled { opacity: .65; }
.mode-list:disabled .mode-option { cursor: wait; }
.mode-detail { border: 1px solid var(--line); background: var(--surface-inset); border-radius: var(--r-m); padding: 18px; display: flex; flex-direction: column; justify-content: center; gap: 12px; min-width: 0; }
.mode-detail-heading { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; }
.mode-detail h3 { margin: 0; font-size: 17px; }
.mode-detail .badge { font-size: 10px; }
.mode-summary { font-size: 12px; color: var(--ink-2); margin: 0; line-height: 1.55; }
.mode-goal { display: flex; gap: 7px; align-items: flex-start; font-size: 12px; margin: 0; line-height: 1.45; }
.mode-goal svg { flex: none; color: var(--accent); }
.mode-rule-link { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; align-self: flex-start; }
@media (min-width: 1200px) { .mode-group:first-of-type .mode-group-options { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 740px) {
  .mode-picker { grid-template-columns: minmax(0, 1fr); gap: 16px; }
  .mode-list { gap: 12px; }
  .mode-detail { padding: 14px; }
  .mode-detail :deep(.standard-boards svg) { max-width: 156px; }
  .mode-detail :deep(.multi-board-wrap) { max-width: 180px; }
  .mode-detail :deep(.mode-preview.double .multi-board-wrap) { max-width: 440px; }
  .mode-option { min-height: 62px; padding: 10px; }
}
</style>
