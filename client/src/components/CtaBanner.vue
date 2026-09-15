<script setup lang="ts">
import { useRouter } from 'vue-router';
import AppIcon from './AppIcon.vue';

const props = withDefaults(
  defineProps<{
    title?: string;
    subtitle?: string;
    currentMode?: 'duo' | 'bughouse' | 'about';
  }>(),
  {
    title: 'Готовы испытать себя в командных шахматах?',
    subtitle:
      'Создайте приватный стол для друзей или начните мгновенную игру со свободными игроками и Stockfish-ботами прямо сейчас.',
    currentMode: 'about',
  },
);

const router = useRouter();

function play2x2(): void {
  router.push({ path: '/', query: { action: 'quick' } });
}
</script>

<template>
  <aside class="cta-box" aria-label="Призыв к игре">
    <h3>{{ title }}</h3>
    <p>{{ subtitle }}</p>
    <div class="cta-buttons">
      <button type="button" class="primary big" @click="play2x2">
        <AppIcon name="bolt" :size="16" />
        Сыграть партию 2х2
      </button>
      <router-link to="/leaderboard" class="button ghost">
        <AppIcon name="crown" :size="14" />
        Таблица лидеров
      </router-link>
    </div>
  </aside>
</template>
