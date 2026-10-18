<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from '../stores/i18n';
import AppIcon from './AppIcon.vue';

const i18n = useI18n();

const props = defineProps<{
  title?: string;
  subtitle?: string;
  currentMode?: 'duo' | 'bughouse' | 'about';
}>();

const router = useRouter();

const displayTitle = computed(() => {
  if (props.title) return props.title;
  return i18n.locale === 'en'
    ? 'Ready to test your team chess skills?'
    : 'Готовы испытать себя в командных шахматах?';
});

const displaySubtitle = computed(() => {
  if (props.subtitle) return props.subtitle;
  return i18n.locale === 'en'
    ? 'Create a private table for friends or jump into a quick match with online players and Stockfish bots right now.'
    : 'Создайте приватный стол для друзей или начните мгновенную игру со свободными игроками и Stockfish-ботами прямо сейчас.';
});

function play2x2(): void {
  router.push({ path: '/', query: { action: 'quick', mode: props.currentMode ?? 'team' } });
}
</script>

<template>
  <aside class="cta-box" :aria-label="i18n.locale === 'en' ? 'Call to action' : 'Призыв к игре'">
    <h3>{{ displayTitle }}</h3>
    <p>{{ displaySubtitle }}</p>
    <div class="cta-buttons">
      <button type="button" class="primary big" @click="play2x2">
        <AppIcon name="bolt" :size="16" />
        {{ props.currentMode === 'bughouse' ? (i18n.locale === 'en' ? 'Play Bughouse' : 'Играть в багхаус') : (i18n.locale === 'en' ? 'Play 2v2 Match' : 'Сыграть партию 2×2') }}
      </button>
      <router-link to="/leaderboard" class="button ghost">
        <AppIcon name="crown" :size="14" />
        {{ i18n.t.nav.leaderboard }}
      </router-link>
    </div>
  </aside>
</template>
