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
  guest?: boolean;
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
</script>
<template>
  <section class="panel quick-play" aria-labelledby="quick-play-title">
    <div class="quick-row">
      <h2 id="quick-play-title">{{ en ? "Quick play" : "Быстрая игра" }}</h2>
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
        }}<span v-if="!busy && !loading" class="clock-label">{{
          clockLabel
        }}</span>
      </button>
    </div>
    <div class="quick-context">
      <span>{{ selected.detail }}</span
      ><router-link :to="selected.rule">{{
        en ? "Rules" : "Правила"
      }}</router-link>
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
.quick-play {
  padding: 14px 16px;
}
.quick-row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.quick-row h2 {
  font-size: 18px;
  white-space: nowrap;
  margin: 0;
}
.mode-options {
  display: flex;
  gap: 4px;
  padding: 3px;
  margin: 0;
  border: 1px solid var(--line);
  border-radius: var(--r-s);
  background: var(--surface-inset);
  flex: 1;
  min-width: 0;
}
.mode-choice {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 36px;
  padding: 0 10px;
  border-radius: 5px;
  white-space: nowrap;
  cursor: pointer;
  font-size: 13px;
  color: var(--ink-2);
}
.mode-choice.selected {
  background: var(--felt);
  color: var(--felt-ink);
}
.mode-choice:hover:not(.selected) {
  background: var(--surface-hover);
  color: var(--ink);
}
.mode-choice input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  margin: 0;
}
.mode-choice:has(input:focus-visible) {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.mode-options:disabled {
  opacity: 0.65;
}
.quick-action {
  min-height: 44px;
  gap: 8px;
  flex: none;
}
.clock-label {
  font-weight: 400;
  opacity: 0.85;
}
.quick-context {
  display: flex;
  gap: 12px;
  margin-top: 8px;
  color: var(--ink-2);
  font-size: 12px;
  flex-wrap: wrap;
}
.quick-context a {
  text-decoration: underline;
  text-underline-offset: 2px;
}
.quick-error {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 13px;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
@media (max-width: 850px) {
  .quick-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 10px;
  }
  .mode-options {
    grid-row: 2;
    grid-column: 1/-1;
    width: 100%;
    box-sizing: border-box;
  }
  .quick-action {
    grid-column: 2;
    grid-row: 1;
  }
  .mode-choice {
    padding: 0 6px;
  }
}
@media (max-width: 420px) {
  .quick-play {
    padding: 12px;
  }
  .mode-options {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .mode-choice {
    white-space: normal;
    min-height: 34px;
  }
  .quick-row h2 {
    font-size: 17px;
  }
}
</style>
