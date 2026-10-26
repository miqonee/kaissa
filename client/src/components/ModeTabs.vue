<script setup lang="ts">
import { GAME_MODES, modeLabel, type GameMode } from "shared";
import { useI18n } from "../stores/i18n";
defineProps<{ modelValue: GameMode }>();
const emit = defineEmits<{ (e: "update:modelValue", mode: GameMode): void }>();
const i18n = useI18n();
</script>
<template>
  <div
    class="mode-tabs"
    role="group"
    :aria-label="i18n.locale === 'en' ? 'Game mode' : 'Режим игры'"
  >
    <button
      v-for="mode in GAME_MODES"
      :key="mode"
      type="button"
      :class="{ primary: modelValue === mode, ghost: modelValue !== mode }"
      :aria-pressed="modelValue === mode"
      @click="emit('update:modelValue', mode)"
    >
      {{ modeLabel(mode, i18n.locale) }}
    </button>
  </div>
</template>
<style scoped>
.mode-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 14px 16px;
}
.mode-tabs button {
  flex: 1 1 auto;
  font-size: 13px;
}
</style>
