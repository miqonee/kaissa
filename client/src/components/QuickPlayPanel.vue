<script setup lang="ts">
import { computed } from 'vue';
import { defaultTimeControl, modeGuide, type GameMode, type LobbySummary } from 'shared';
import { useI18n } from '../stores/i18n';
import AppIcon from './AppIcon.vue';
import ModePicker from './ModePicker.vue';
const props = defineProps<{ modelValue: GameMode; lobby?: LobbySummary; busy: boolean; loading: boolean; error?: string }>();
const emit = defineEmits<{
  (event: 'update:modelValue', value: GameMode): void;
  (event: 'play', lobby: LobbySummary): void;
  (event: 'retry'): void;
}>();
const i18n = useI18n();
const en = computed(() => i18n.locale === 'en');
const selected = computed(() => modeGuide(props.modelValue, i18n.locale));
const clock = computed(() => props.lobby?.timeControl ?? defaultTimeControl(props.modelValue));
const clockLabel = computed(() => clock.value.kind === 'none' ? en.value ? 'No clock' : 'Без часов' : `${clock.value.baseMin}+${clock.value.incSec}`);
</script>
<template>
  <section class="quick-play" aria-labelledby="quick-play-title">
    <header class="quick-heading"><h2 id="quick-play-title">{{ en ? 'Choose a game' : 'Выберите игру' }}</h2><span class="dim">{{ en ? 'Start solo or bring friends' : 'Начните один или пригласите друзей' }}</span></header>
    <ModePicker :model-value="modelValue" :disabled="busy" @update:model-value="emit('update:modelValue', $event)" />
    <footer class="quick-footer">
      <p class="quick-hint"><AppIcon name="user" :size="18" /><span>{{ en ? 'Bots fill empty seats. Invite friends and change the clock in the lobby.' : 'Боты займут свободные места. Пригласить друзей и выбрать время можно в лобби.' }}</span></p>
      <button class="primary quick-action" :disabled="busy || loading || !lobby || !!error" @click="lobby && emit('play', lobby)" :aria-label="`${en ? 'Play' : 'Играть'}: ${selected.name}, ${clockLabel}`">
        <AppIcon name="play" :size="16" />{{ busy ? (en ? 'Joining…' : 'Подключаем…') : loading ? (en ? 'Loading…' : 'Загрузка…') : (en ? 'Play' : 'Играть') }}<span v-if="!busy && !loading" class="clock-label">{{ clockLabel }}</span>
      </button>
    </footer>
    <div v-if="error || (!loading && !lobby)" class="quick-error" role="status"><span>{{ error || (en ? 'Preparing a table. Refresh shortly.' : 'Стол подготавливается. Обновите список через несколько секунд.') }}</span><button class="small ghost" :disabled="loading" @click="emit('retry')">{{ en ? 'Refresh' : 'Обновить' }}</button></div>
  </section>
</template>
<style scoped>
.quick-play { padding: 22px; }
.quick-heading { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 20px; }
.quick-heading h2 { font-size: 19px; margin: 0; }
.quick-heading > span { font-size: 12px; }
.quick-footer { display: flex; align-items: center; justify-content: space-between; gap: 24px; border-top: 1px solid var(--line); margin-top: 20px; padding-top: 16px; }
.quick-hint { display: flex; align-items: center; gap: 10px; margin: 0; max-width: 530px; color: var(--ink-2); font-size: 12px; line-height: 1.5; }
.quick-hint svg { flex: none; }
.quick-action { min-height: 46px; min-width: 220px; justify-content: center; padding: 0 20px; gap: 10px; }
.clock-label { padding-left: 10px; border-left: 1px solid currentColor; font-size: 12px; font-weight: 400; }
.quick-error { margin-top: 12px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 13px; }
@media (max-width: 740px) {
  .quick-play { padding: 16px; }
  .quick-heading { margin-bottom: 16px; }
  .quick-footer { flex-direction: column; align-items: stretch; gap: 12px; }
  .quick-action { width: 100%; }
}
</style>
