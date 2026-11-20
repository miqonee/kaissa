<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { modeLabel, timeControlLabel, type GameSummary, type MoveRecord } from 'shared';
import { api } from '../api/rest';
import { useI18n } from '../stores/i18n';
import { useDialog } from '../composables/useDialog';
import AppIcon from './AppIcon.vue';
import GameReplayer from './GameReplayer.vue';

const i18n = useI18n();

const props = defineProps<{
  gameId: number;
  /** заголовок в шапке модалки (по умолчанию «Партия #id») */
  title?: string;
}>();

const emit = defineEmits<{ (e: 'close'): void }>();

const game = ref<GameSummary | null>(null);
const moves = ref<MoveRecord[]>([]);
const error = ref('');
const loading = ref(true);

let request = 0;
async function load(): Promise<void> {
  const generation = ++request;
  loading.value = true;
  error.value = '';
  try {
    const res = await api.get<{ game: GameSummary; moves: MoveRecord[] }>(`/api/games/${props.gameId}`);
    if (generation !== request) return;
    game.value = res.game;
    moves.value = res.moves;
  } catch (e) {
    if (generation !== request) return;
    error.value = e instanceof Error ? e.message : (i18n.locale === 'en' ? 'Failed to load game' : 'Не удалось загрузить партию');
  } finally {
    if (generation === request) loading.value = false;
  }
}

const dialog = ref<HTMLElement | null>(null);
useDialog(dialog, () => emit('close'));
onMounted(load);

watch(() => props.gameId, load);
</script>

<template>
  <div class="modal-backdrop replay-backdrop" @click.self="emit('close')">
    <div
      ref="dialog"
      tabindex="-1"
      class="modal replay-modal"
      :class="{ 'two-boards': game?.mode === 'bughouse', 'wide-board': game?.mode === 'double' }"
      role="dialog"
      aria-modal="true"
      :aria-label="title ?? (i18n.locale === 'en' ? `Match #${gameId}` : `Партия #${gameId}`)"
    >
      <header class="modal-head">
        <div class="replay-title">
          <h2>{{ title ?? (i18n.locale === 'en' ? `Match #${gameId}` : `Партия #${gameId}`) }}</h2>
          <span v-if="game && !loading && !error" class="replay-facts">
            <span>{{ modeLabel(game.mode, i18n.locale) }}<template v-if="game.mode === 'double'"> · 16×8</template></span>
            <span class="replay-clock mono"><AppIcon name="clock" :size="13" />{{ game.timeControl.kind === 'none' ? (i18n.locale === 'en' ? 'No clock' : 'Без часов') : timeControlLabel(game.timeControl) }}</span>
          </span>
        </div>
        <div class="rh-actions">
          <button class="modal-close" :aria-label="i18n.locale === 'en' ? 'Close' : 'Закрыть'" @click="emit('close')">
            <AppIcon name="close" :size="18" />
          </button>
        </div>
      </header>

      <div class="modal-body">
        <div v-if="loading" class="empty">{{ i18n.locale === 'en' ? 'Loading game…' : 'Загружаем партию…' }}</div>
        <div v-else-if="error" class="empty">
          <p class="empty-title" role="alert">{{ error }}</p>
          <button @click="load">{{ i18n.locale === 'en' ? 'Try again' : 'Повторить' }}</button>
        </div>
        <GameReplayer v-else-if="game" :game="game" :moves="moves" compact />
      </div>
    </div>
  </div>
</template>

<style scoped>
.replay-backdrop { padding: 12px; z-index: 1100; overflow: hidden; }
.replay-modal { width: min(960px, 100%); max-width: 960px; height: min(860px, calc(100dvh - 24px)); max-height: calc(100dvh - 24px); margin: auto; display: flex; flex-direction: column; overflow: hidden; }
.replay-modal.two-boards { width: min(1200px, 100%); max-width: 1200px; }
.replay-modal.wide-board { width: min(1240px, 100%); max-width: 1240px; }
.replay-modal .modal-head { flex: none; padding: 10px 16px; }
.replay-title, .replay-facts, .replay-clock { display: flex; align-items: center; min-width: 0; }
.replay-title { flex-wrap: wrap; gap: 2px 14px; }
.replay-facts { gap: 10px; color: var(--ink-2); font-size: 12px; }
.replay-clock { gap: 4px; white-space: nowrap; }
.replay-modal .modal-close { width: 32px; height: 32px; }
.replay-modal .modal-body { flex: 1; min-height: 0; padding: 12px 16px; overflow: hidden; display: flex; flex-direction: column; }
.replay-modal :deep(.replayer) { flex: 1; min-height: 0; }
.rh-actions { display: flex; align-items: center; gap: var(--gap-xs); }
@media (max-width: 720px) {
  .replay-backdrop { padding: 0; }
  .replay-modal, .replay-modal.two-boards, .replay-modal.wide-board { width: 100%; max-width: 100%; height: 100dvh; max-height: 100dvh; border: 0; border-radius: 0; padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom); }
  .replay-modal .modal-head { padding: 10px 12px; }
  .replay-modal .modal-body { padding: 6px 8px 8px; }
}
</style>
