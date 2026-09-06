<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import type { GameSummary, MoveRecord } from 'shared';
import { api } from '../api/rest';
import GameReplayer from '../components/GameReplayer.vue';
import AppIcon from '../components/AppIcon.vue';

const route = useRoute();
const gameId = Number(route.params.id);

const game = ref<GameSummary | null>(null);
const moves = ref<MoveRecord[]>([]);
const error = ref('');

onMounted(async () => {
  try {
    const res = await api.get<{ game: GameSummary; moves: MoveRecord[] }>(`/api/games/${gameId}`);
    game.value = res.game;
    moves.value = res.moves;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Не удалось загрузить партию';
  }
});
</script>

<template>
  <div class="replay-page">
    <div class="page-head">
      <div>
        <h1>Партия #{{ gameId }}</h1>
        <p class="sub">Разбор партии: ходы, позиции и карманы</p>
      </div>
      <router-link to="/history" class="button ghost small">
        <AppIcon name="arrow-left" :size="14" /> К архиву
      </router-link>
    </div>

    <div v-if="error" class="panel">
      <div class="empty">
        <p class="empty-title">{{ error }}</p>
        <router-link to="/history" class="button primary small">Вернуться в архив</router-link>
      </div>
    </div>

    <div v-else-if="game" class="panel">
      <div class="panel-body">
        <GameReplayer :game="game" :moves="moves" />
      </div>
    </div>

    <div v-else class="panel">
      <div class="empty">Загружаем партию…</div>
    </div>
  </div>
</template>

<style scoped>
.replay-page {
  display: flex;
  flex-direction: column;
  gap: var(--gap-m);
}

.page-head .sub {
  margin: 4px 0 0;
}
</style>
