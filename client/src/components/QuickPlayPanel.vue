<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from "vue";
import {
  GAME_MODES,
  defaultTimeControl,
  type GameMode,
  type LobbySummary,
} from "shared";
import { useI18n } from "../stores/i18n";
import AppIcon from "./AppIcon.vue";
import ModeBoardPreview from "./ModeBoardPreview.vue";
const props = defineProps<{
  modelValue: GameMode;
  lobby?: LobbySummary;
  busy: boolean;
  loading: boolean;
  error?: string;
}>();
const emit = defineEmits<{
  (event: "update:modelValue", value: GameMode): void;
  (event: "play", lobby: LobbySummary): void;
  (event: "retry"): void;
}>();
const i18n = useI18n();
const en = computed(() => i18n.locale === "en");
const modes = computed(() => ({
  team: {
    name: "2×2",
    detail: en.value
      ? "One board · alternating turns"
      : "Одна доска · ходы по очереди",
    rule: "/rules/duo",
  },
  double: {
    name: en.value ? "Double Chess" : "Двойные",
    detail: en.value ? "16×8 · shared board · two teams" : "16×8 · общая доска · две команды",
    rule: "/rules/double",
  },
  bughouse: {
    name: en.value ? "Bughouse" : "Багхаус",
    detail: en.value
      ? "Two boards · share captures"
      : "Две доски · обмен фигурами",
    rule: "/rules/bughouse",
  },
  crazyhouse: {
    name: "Crazyhouse 1×1",
    detail: en.value
      ? "One opponent · your own reserve"
      : "Один соперник · свой резерв",
    rule: "/rules/crazyhouse",
  },
  "crazyhouse-team": {
    name: "Crazyhouse 2×2",
    detail: en.value
      ? "One board · team reserve"
      : "Одна доска · резерв команды",
    rule: "/rules/crazyhouse",
  },
  "four-player": {
    name: en.value ? "4 Players" : "4 игрока",
    detail: en.value
      ? "14×14 cross board · 4 colors FFA"
      : "Доска-крест 14×14 · 4 цвета",
    rule: "/rules/multiplayer",
  },
  "three-player": {
    name: en.value ? "3 Players" : "3 игрока",
    detail: en.value
      ? "Hexagonal board · 3 colors FFA"
      : "Шестиугольная доска · 3 цвета",
    rule: "/rules/multiplayer",
  },
}));
const selected = computed(() => modes.value[props.modelValue]);
const clock = computed(
  () => props.lobby?.timeControl ?? defaultTimeControl(props.modelValue),
);
const clockLabel = computed(() =>
  clock.value.kind === "none"
    ? en.value
      ? "No clock"
      : "Без часов"
    : `${clock.value.baseMin}+${clock.value.incSec}`,
);
const previewId = `${useId()}-quick-preview`;
const previewMode = ref<GameMode | null>(null);
const previewPinned = ref(false);
let keyboardPreview = false;
const playButton = ref<HTMLButtonElement | null>(null);
const previewAnchor = ref<HTMLElement | null>(null);
const previewPanel = ref<HTMLElement | null>(null);
const previewButton = ref<HTMLButtonElement | null>(null);
const previewStyle = ref<Record<string, string>>({});
let showTimer: ReturnType<typeof setTimeout> | undefined;
let hideTimer: ReturnType<typeof setTimeout> | undefined;
function clearPreviewTimers(): void { clearTimeout(showTimer); clearTimeout(hideTimer); }
function closePreview(restoreFocus = false): void {
  clearPreviewTimers();
  const wasPinned = previewPinned.value;
  previewMode.value = null;
  previewPinned.value = false;
  if (restoreFocus && wasPinned) void nextTick(() => previewButton.value?.focus());
}
function positionPreview(): void {
  const anchor = previewAnchor.value;
  if (!anchor || !previewMode.value) return;
  const rect = anchor.getBoundingClientRect();
  // The radio row disappears at the native-select breakpoint.
  if (!rect.width || rect.bottom < 0 || rect.top > window.innerHeight) { closePreview(); return; }
  const margin = 12, gap = 8;
  const width = Math.min(300, window.innerWidth - margin * 2);
  const below = window.innerHeight - rect.bottom - margin - gap;
  const above = rect.top - margin - gap;
  const height = previewPanel.value?.scrollHeight ?? 320;
  const useBelow = below >= height || below >= above;
  const maxHeight = Math.max(80, useBelow ? below : above);
  previewStyle.value = {
    width: `${width}px`, maxHeight: `${Math.min(maxHeight, window.innerHeight - margin * 2)}px`,
    left: `${Math.max(margin, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - margin))}px`,
    top: `${Math.max(margin, useBelow ? rect.bottom + gap : rect.top - gap - Math.min(height, maxHeight))}px`,
  };
}
async function showPreview(mode: GameMode, anchor: HTMLElement, pinned = false, keyboard = false): Promise<void> {
  if (props.busy) return;
  clearPreviewTimers();
  keyboardPreview = keyboard;
  previewAnchor.value = anchor;
  previewPinned.value = pinned;
  previewMode.value = mode;
  await nextTick();
  positionPreview();
  if (pinned) previewPanel.value?.querySelector<HTMLButtonElement>('button')?.focus();
}
function enterMode(event: PointerEvent, mode: GameMode): void {
  if (event.pointerType !== 'mouse' || previewPinned.value) return;
  clearPreviewTimers();
  const anchor = event.currentTarget as HTMLElement;
  showTimer = setTimeout(() => { void showPreview(mode, anchor); }, 200);
}
function focusMode(event: FocusEvent, mode: GameMode): void {
  const input = event.target as HTMLInputElement;
  if (input.matches(':focus-visible')) void showPreview(mode, input.parentElement!, false, true);
}
function leavePreview(): void {
  clearPreviewTimers();
  if (keyboardPreview && previewAnchor.value?.contains(document.activeElement)) return;
  if (!previewPinned.value) hideTimer = setTimeout(() => closePreview(), 180);
}
function leaveDialog(event: KeyboardEvent): void {
  if (event.key !== 'Tab' || !previewPinned.value) return;
  // This is a non-modal panel: continue in the trigger's logical tab order,
  // rather than tabbing from the Teleport at the very end of the document.
  event.preventDefault();
  const target = event.shiftKey || playButton.value?.disabled ? previewButton.value : playButton.value;
  closePreview();
  void nextTick(() => target?.focus());
}
function togglePreview(): void {
  if (previewPinned.value) closePreview(true);
  else if (previewButton.value) void showPreview(props.modelValue, previewButton.value, true);
}
function outsidePreview(event: Event): void {
  const target = event.target;
  if (target instanceof Node && !previewAnchor.value?.contains(target) && !previewPanel.value?.contains(target)) closePreview();
}
function escapePreview(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !previewMode.value) return;
  event.preventDefault();
  closePreview(true);
}
watch(() => props.busy, busy => { if (busy) closePreview(); });
watch(() => props.modelValue, () => { if (previewPinned.value) closePreview(); });
onMounted(() => {
  document.addEventListener('pointerdown', outsidePreview);
  document.addEventListener('focusin', outsidePreview);
  document.addEventListener('keydown', escapePreview);
  window.addEventListener('resize', positionPreview);
  window.addEventListener('scroll', positionPreview, true);
});
onBeforeUnmount(() => {
  clearPreviewTimers();
  document.removeEventListener('pointerdown', outsidePreview);
  document.removeEventListener('focusin', outsidePreview);
  document.removeEventListener('keydown', escapePreview);
  window.removeEventListener('resize', positionPreview);
  window.removeEventListener('scroll', positionPreview, true);
});
function selectMode(event: Event): void {
  const mode = (event.target as HTMLSelectElement).value as GameMode;
  if (GAME_MODES.includes(mode)) emit("update:modelValue", mode);
}
</script>
<template>
  <section class="quick-play" aria-labelledby="quick-play-title">
    <div class="quick-row">
      <div class="quick-heading">
        <h2 id="quick-play-title">{{ en ? "Quick play" : "Быстрая игра" }}</h2>
        <router-link
          class="quick-rules"
          :to="selected.rule"
          :title="`${en ? 'Rules' : 'Правила'}: ${selected.name}. ${selected.detail}`"
          :aria-label="`${en ? 'Rules' : 'Правила'}: ${selected.name}`"
        ><AppIcon name="book-open" :size="16" /><span class="rules-label">{{ en ? 'Rules' : 'Правила' }}</span></router-link>
      </div>
      <fieldset class="mode-options" :disabled="busy">
        <legend class="sr-only">
          {{ en ? "Game format" : "Формат игры" }}
        </legend>
        <label
          v-for="mode in GAME_MODES"
          :key="mode"
          class="mode-choice"
          :class="{ selected: modelValue === mode }"
          @pointerenter="enterMode($event, mode)"
          @pointerleave="leavePreview"
        >
          <input
            type="radio"
            name="quick-mode"
            :checked="modelValue === mode"
            :value="mode"
            :aria-describedby="`${previewId}-${mode}-description`"
            @focus="focusMode($event, mode)"
            @change="emit('update:modelValue', mode)"
          />
          <span>{{ modes[mode].name }}</span>
        </label>
      </fieldset>
      <span v-for="mode in GAME_MODES" :id="`${previewId}-${mode}-description`" :key="mode" class="sr-only">{{ modes[mode].detail }}</span>
      <div class="compact-mode-controls">
      <select
        class="mode-select"
        :value="modelValue"
        :disabled="busy"
        :aria-label="en ? 'Game format' : 'Формат игры'"
        @change="selectMode"
      ><option v-for="mode in GAME_MODES" :key="mode" :value="mode">{{ modes[mode].name }}</option></select>
      <button ref="previewButton" type="button" class="ghost quick-preview-trigger" :disabled="busy"
        :aria-label="`${en ? 'Preview board' : 'Посмотреть доску'}: ${selected.name}`"
        aria-haspopup="dialog" :aria-expanded="previewPinned" :aria-controls="previewPinned ? previewId : undefined"
        @click="togglePreview"><AppIcon name="eye" :size="18" /></button>
      </div>
      <button
        ref="playButton" class="primary quick-action"
        :disabled="busy || loading || !lobby || !!error"
        @click="lobby && emit('play', lobby)"
        :aria-label="
          en
            ? `Play ${selected.name}, ${clockLabel}`
            : `Играть в ${selected.name}, ${clockLabel}`
        "
      >
        <AppIcon name="play" :size="14" />{{
          busy
            ? en
              ? "Joining…"
              : "Подключаем…"
            : loading
              ? en
                ? "Loading…"
                : "Загрузка…"
              : en
                ? "Play"
                : "Играть"
        }}<span v-if="!busy && !loading" class="clock-label" :title="clockLabel">{{
          clock.kind === 'none' ? '∞' : clockLabel
        }}</span>
      </button>
    </div>
    <Teleport to="body">
      <section v-if="previewMode" :id="previewId" ref="previewPanel" class="quick-mode-preview"
        :style="previewStyle" :role="previewPinned ? 'dialog' : 'tooltip'"
        :aria-label="`${en ? 'Board preview' : 'Предпросмотр доски'}: ${modes[previewMode].name}`"
        @pointerenter="clearPreviewTimers" @pointerleave="leavePreview" @keydown="leaveDialog">
        <div class="quick-preview-heading"><h3>{{ modes[previewMode].name }}</h3>
          <button v-if="previewPinned" type="button" class="ghost quick-preview-close"
            :aria-label="en ? 'Close preview' : 'Закрыть предпросмотр'" @click="closePreview(true)"><AppIcon name="close" :size="18" /></button>
        </div>
        <p>{{ modes[previewMode].detail }}</p>
        <ModeBoardPreview :mode="previewMode" />
      </section>
    </Teleport>
    <div v-if="error || (!loading && !lobby)" class="quick-error" role="status">
      <span>{{
        error ||
        (en
          ? "Preparing a table. Refresh shortly."
          : "Стол подготавливается. Обновите список через несколько секунд.")
      }}</span
      ><button class="small ghost" :disabled="loading" @click="emit('retry')">
        {{ en ? "Refresh" : "Обновить" }}
      </button>
    </div>
  </section>
</template>
<style scoped>
.quick-play { padding: 14px 16px; }
.quick-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
}
.quick-heading { display: flex; align-items: center; gap: 4px; }
.quick-heading h2 { font-size: 16px; white-space: nowrap; margin: 0; }
.quick-rules {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: var(--control-size);
  height: var(--control-size);
  color: var(--ink-2);
  border-radius: var(--r-s);
  text-decoration: none;
}
.quick-rules:hover { background: var(--surface-hover); color: var(--ink); }
.rules-label { display: none; }
.mode-options {
  display: flex;
  gap: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
  height: var(--control-size);
  border: 1px solid var(--line);
  border-radius: var(--r-s);
  background: var(--surface-inset);
}
.mode-choice {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-width: 0;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: calc(var(--r-s) - 1px);
  white-space: nowrap;
  cursor: pointer;
  font-size: 13px;
  color: var(--ink-2);
}
.mode-choice.selected {
  background: var(--surface);
  color: var(--ink);
  border-color: var(--line-2);
  font-weight: 600;
}
.mode-choice:hover:not(.selected) { background: var(--surface-hover); color: var(--ink); }
.mode-choice input { position: absolute; width: 1px; height: 1px; opacity: 0; margin: 0; }
.mode-choice:has(input:focus-visible), .quick-rules:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.mode-options:disabled { opacity: 0.65; }
.mode-options:disabled .mode-choice { cursor: wait; }
.compact-mode-controls { display: none; min-width: 0; align-items: center; gap: 6px; }
.quick-preview-trigger { min-width: 44px; height: 44px; padding: 0; justify-content: center; }
.quick-mode-preview { position: fixed; z-index: 1200; box-sizing: border-box; overflow: auto; padding: 14px; border: 1px solid var(--line-2); border-radius: var(--r-m); background: var(--surface); color: var(--ink); box-shadow: var(--shadow-l); }
.quick-preview-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.quick-preview-heading h3 { font-size: 15px; margin: 0; }
.quick-mode-preview > p { margin: 6px 0 12px; font-size: 12px; line-height: 1.5; color: var(--ink-2); }
.quick-preview-close { width: 44px; height: 44px; padding: 0; flex: none; justify-content: center; }
.quick-preview-trigger:focus-visible, .quick-preview-close:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.mode-select { display: none; }
.quick-action {
  height: var(--control-size);
  min-height: var(--control-size);
  min-width: 124px;
  padding: 0 14px;
  gap: 8px;
  font-size: 13px;
}
.clock-label { font-weight: 400; opacity: 0.85; }
.quick-error { margin-top: 10px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 13px; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
@media (max-width: 920px) {
  .quick-row { grid-template-columns: minmax(0, 1fr) auto; gap: 8px 12px; }
  .quick-heading { grid-column: 1 / -1; justify-content: space-between; }
  .quick-rules { height: 28px; font-size: 12px; }
  .rules-label { display: inline; }
  .mode-choice { padding: 0 6px; }
}
@media (max-width: 1100px), (hover: none), (pointer: coarse) {
  .compact-mode-controls { display: flex; }
  .mode-options { display: none; }
  .mode-select { display: block; width: 100%; min-width: 0; height: var(--control-size); padding: 0 10px; border-radius: var(--r-s); font-size: 14px; }
}
@media (max-width: 640px) {
  .quick-play { padding: 12px; }
  .mode-options { display: none; }
  .mode-select {
    display: block;
    width: 100%;
    min-width: 0;
    height: var(--control-size);
    padding: 0 10px;
    border-radius: var(--r-s);
    font-size: 14px;
  }
  .quick-action { min-width: 112px; padding: 0 10px; }
}
@media (pointer: coarse) {
  .quick-rules { height: var(--control-size); }
}
</style>
