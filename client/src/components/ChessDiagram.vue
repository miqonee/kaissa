<script setup lang="ts">
import { computed, ref } from 'vue';
import type { PieceType } from 'shared';
import ChessBoard from './ChessBoard.vue';
import AppIcon from './AppIcon.vue';

interface PocketPiece {
  type: PieceType;
  count: number;
}

const props = withDefaults(
  defineProps<{
    title: string;
    badge?: string;
    badgeColor?: 'felt' | 'brass' | 'ok' | 'bad';
    fen: string;
    interactiveFen?: string;
    orientation?: 'white' | 'black';
    pocketWhite?: PocketPiece[];
    pocketBlack?: PocketPiece[];
    actionLabel?: string;
    resetLabel?: string;
    checkSquare?: string | null;
    lastMove?: readonly (string | null)[] | null;
    caption: string;
  }>(),
  {
    badge: 'Диаграмма',
    badgeColor: 'brass',
    orientation: 'white',
    pocketWhite: () => [],
    pocketBlack: () => [],
    actionLabel: 'Показать ход',
    resetLabel: 'Исходная позиция',
    checkSquare: null,
    lastMove: null,
  },
);

const isPlayed = ref(false);

const activeFen = computed(() => {
  if (isPlayed.value && props.interactiveFen) {
    return props.interactiveFen;
  }
  return props.fen;
});

const activeCheckSquare = computed(() => {
  return isPlayed.value ? props.checkSquare : null;
});

const activeLastMove = computed(() => {
  return isPlayed.value ? props.lastMove : null;
});

function toggleMove(): void {
  isPlayed.value = !isPlayed.value;
}
</script>

<template>
  <figure class="diagram-card">
    <div class="diagram-header">
      <span class="diagram-title">{{ title }}</span>
      <span v-if="badge" class="badge" :class="badgeColor">{{ badge }}</span>
    </div>

    <!-- Резерв (карман) белых / чёрных при наличии -->
    <div v-if="pocketWhite.length || pocketBlack.length" class="diagram-pocket-bar">
      <span class="diagram-pocket-label">Карман:</span>
      <div class="diagram-pocket-chips">
        <template v-for="p in pocketWhite" :key="`w-${p.type}`">
          <span class="diagram-pocket-chip" :title="`Белая фигура: ${p.type}`">
            <img :src="`/pieces/cburnett/w${p.type.toUpperCase()}.svg`" :alt="p.type" />
            <span v-if="p.count > 1" class="mono tiny">×{{ p.count }}</span>
          </span>
        </template>
        <template v-for="p in pocketBlack" :key="`b-${p.type}`">
          <span class="diagram-pocket-chip" :title="`Чёрная фигура: ${p.type}`">
            <img :src="`/pieces/cburnett/b${p.type.toUpperCase()}.svg`" :alt="p.type" />
            <span v-if="p.count > 1" class="mono tiny">×{{ p.count }}</span>
          </span>
        </template>
      </div>
    </div>

    <!-- Доска -->
    <div class="diagram-board-container">
      <ChessBoard
        :fen="activeFen"
        :orientation="orientation"
        :coordinates="true"
        :mini="false"
        :movable-color="null"
        :check-square="activeCheckSquare"
        :last-move="activeLastMove"
      />
    </div>

    <!-- Кнопка интерактивного переключения -->
    <div v-if="interactiveFen" class="diagram-actions">
      <button
        type="button"
        class="small"
        :class="isPlayed ? 'ghost' : 'brass'"
        @click="toggleMove"
      >
        <AppIcon :name="isPlayed ? 'refresh' : 'play'" :size="13" />
        {{ isPlayed ? resetLabel : actionLabel }}
      </button>
    </div>

    <!-- Семантическая подпись -->
    <figcaption>{{ caption }}</figcaption>
  </figure>
</template>
