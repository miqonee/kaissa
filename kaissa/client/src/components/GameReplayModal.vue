<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import type { GameSummary, MoveRecord } from 'shared';
import { api } from '../api/rest';
import AppIcon from './AppIcon.vue';
import GameReplayer from './GameReplayer.vue';

const props = defineProps<{
  gameId: number;
  /** заголовок в шапке модалки (по умолчанию «Партия #id») */
  title?: string;
}>();

const emit = defineEmits<{ (e: 'close'): void }>();

const router = useRouter();

const game = ref<GameSummary | null>(null);
const moves = ref<MoveRecord[]>([]);
const error = ref('');
const loading = ref(true);

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const res = await api.get<{ game: GameSummary; moves: MoveRecord[] }>(`/api/games/${props.gameId}`);
    game.value = res.game;
    moves.value = res.moves;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Не удалось загрузить партию';
  } finally {
    loading.value = false;
  }
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.stopPropagation();
    emit('close');
  }
}

function openFull(): void {
  router.push(`/replay/${props.gameId}`);
}

// Блокируем прокрутку фона, пока открыта модалка
const prevOverflow = ref('');

onMounted(() => {
  prevOverflow.value = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', onKey);
  void load();
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey);
  document.body.style.overflow = prevOverflow.value;
});

watch(() => props.gameId, load);
</script>

<template>
  <div class="modal-backdrop replay-backdrop" @click.self="emit('close')">
    <div
      class="modal replay-modal"
      :class="{ 'two-boards': game?.mode === 'bughouse' }"
      role="dialog"
      aria-modal="true"
      :aria-label="title ?? `Партия #${gameId}`"
    >
      <div class="modal-head">
        <h2>{{ title ?? `Партия #${gameId}` }}</h2>
        <div class="rh-actions">
          <button class="small ghost" title="Открыть плеер на всю страницу" @click="openFull">
            <AppIcon name="external" :size="14" /> На всю страницу
          </button>
          <button class="modal-close" aria-label="Закрыть" @click="emit('close')">
            <AppIcon name="close" :size="18" />
          </button>
        </div>
      </div>

      <div class="modal-body">
        <div v-if="loading" class="empty">Загружаем партию…</div>
        <div v-else-if="error" class="empty">
          <p class="empty-title">{{ error }}</p>
        </div>
        <GameReplayer v-else-if="game" :game="game" :moves="moves" compact />
      </div>
    </div>
  </div>
</template>

<style scoped>
.replay-backdrop {
  padding: var(--gap-s);
  z-index: 1100;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
}

/* Для одной доски модалка компактная (860px) — без лишней пустоты по горизонтали */
.replay-modal {
  width: 100%;
  max-width: min(860px, 96vw);
  max-height: calc(100vh - 24px);
  margin: auto;
  display: flex;
  flex-direction: column;
}

/* Для двух досок (багхаус) модалка шире */
.replay-modal.two-boards {
  max-width: min(1140px, 96vw);
}

.replay-modal .modal-body {
  padding: 14px 20px 18px;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

/* Компактный плеер в модалке: крупная доска по высоте экрана + всегда видимый снизу транспорт */
.replay-modal :deep(.replayer.compact) {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.replay-modal :deep(.replayer.compact .replayer-head) {
  flex-shrink: 0;
  gap: var(--gap-xs);
}

.replay-modal :deep(.replayer.compact .replayer-body) {
  grid-template-columns: minmax(0, 1fr) 240px;
  gap: 16px;
  align-items: start;
}

/* Ограничиваем высоту доски так, чтобы транспортные кнопки под ней всегда оставались в окне */
.replay-modal :deep(.replayer.compact .rp-boards:not(.two)) {
  max-width: min(100%, calc(84vh - 160px));
}

/* Багхаус: две доски комфортного крупного размера */
.replay-modal :deep(.replayer.compact .rp-boards.two) {
  max-width: min(100%, calc((84vh - 170px) * 1.55));
}

.replay-modal :deep(.replayer.compact .rp-moves) {
  max-height: calc(84vh - 200px);
  min-height: 180px;
}

.replay-modal :deep(.replayer.compact .rp-pocket) {
  max-width: 100%;
}

.replay-modal :deep(.replayer.compact .rp-transport) {
  flex-shrink: 0;
  margin-top: 4px;
}

.rh-actions {
  display: flex;
  align-items: center;
  gap: var(--gap-xs);
}

/* Мобильный полноэкранный просмотр архива */
@media (max-width: 720px) {
  .replay-backdrop {
    padding: 0;
  }
  .replay-modal {
    max-width: 100vw;
    width: 100vw;
    height: 100vh;
    max-height: 100vh;
    border-radius: 0;
    border: none;
  }
  .replay-modal .modal-body {
    padding: 8px 10px 14px;
  }
  .replay-modal :deep(.replayer.compact .replayer-body) {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  .replay-modal :deep(.replayer.compact .rp-boards:not(.two)) {
    max-width: 100%;
  }
  .replay-modal :deep(.replayer.compact .rp-boards.two) {
    max-width: 100%;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .replay-modal :deep(.replayer.compact .rp-moves) {
    max-height: 180px;
    min-height: 120px;
  }
  .replay-modal :deep(.replayer.compact .rp-transport) {
    padding: 6px 10px;
  }
}
</style>
