<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import type { GameMode, GameState } from 'shared';
import { isMultiplayer } from 'shared';
import { api } from '../api/rest';
import { getSocket } from '../api/socket';
import GamePage from './GamePage.vue';
import MultiGamePage from './MultiGamePage.vue';

const route = useRoute();
const socket = getSocket();

const detectedMode = ref<GameMode | null>(null);
const initialState = ref<GameState | null>(null);
const notFoundError = ref<string>('');

function onGameState(st: GameState): void {
  if (st.gameId !== Number(route.params.id)) return;
  if (!detectedMode.value) {
    initialState.value = st;
    detectedMode.value = st.mode;
  }
}

function onUnavailable(payload: { gameId: number; error: string }): void {
  if (payload.gameId !== Number(route.params.id)) return;
  if (!detectedMode.value) {
    notFoundError.value = payload.error || 'Партия не найдена';
  }
}

function loadMode(): void {
  const id = Number(route.params.id);
  detectedMode.value = null;
  initialState.value = null;
  notFoundError.value = '';
  if (!Number.isFinite(id)) {
    notFoundError.value = 'Некорректный ID партии';
    return;
  }
  socket.emit('game:watch', id);
  api
    .get<{ state: GameState }>(`/api/games/${id}/state`)
    .then((res) => {
      if (res.state && !detectedMode.value) {
        initialState.value = res.state;
        detectedMode.value = res.state.mode;
      }
    })
    .catch(() => {
      // Wait for socket or fall back to classic GamePage which displays unavailable message
      if (!detectedMode.value) {
        detectedMode.value = 'team';
      }
    });
}

watch(() => route.params.id, loadMode);

onMounted(() => {
  socket.on('game:state', onGameState);
  socket.on('game:unavailable', onUnavailable);
  loadMode();
});

onBeforeUnmount(() => {
  socket.off('game:state', onGameState);
  socket.off('game:unavailable', onUnavailable);
});
</script>

<template>
  <MultiGamePage
    v-if="detectedMode && isMultiplayer(detectedMode)"
    :key="`multi-${route.params.id}`"
    :initial-state="initialState"
  />
  <GamePage
    v-else-if="detectedMode"
    :key="`classic-${route.params.id}`"
  />
  <div v-else-if="notFoundError" class="panel" style="padding: 24px; text-align: center;">
    <p>{{ notFoundError }}</p>
    <router-link to="/" class="button ghost small">На главную</router-link>
  </div>
</template>
