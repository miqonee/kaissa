<script setup lang="ts">
import { computed } from "vue";
import {
  GAME_MODES,
  defaultTimeControl,
  type GameMode,
  type LobbySummary,
} from "shared";
import { useI18n } from "../stores/i18n";
import AppIcon from "./AppIcon.vue";
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
          :title="modes[mode].detail"
        >
          <input
            type="radio"
            name="quick-mode"
            :checked="modelValue === mode"
            :value="mode"
            @change="emit('update:modelValue', mode)"
          />
          <span>{{ modes[mode].name }}</span>
        </label>
      </fieldset>
      <select
        class="mode-select"
        :value="modelValue"
        :disabled="busy"
        :aria-label="en ? 'Game format' : 'Формат игры'"
        @change="selectMode"
      ><option v-for="mode in GAME_MODES" :key="mode" :value="mode">{{ modes[mode].name }}</option></select>
      <button
        class="primary quick-action"
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
