<script setup lang="ts">
import { computed } from 'vue';
import ModeBoardPreview from '../components/ModeBoardPreview.vue';
import { usePageSeo } from '../composables/useSeo';
import pages from '../content/seo-pages.json';
import { useI18n } from '../stores/i18n';

const props = defineProps<{ mode: 'three-player' | 'four-player' }>();
const i18n = useI18n();
const page = computed(() => pages[`/play/${props.mode}` as const][i18n.locale]);
usePageSeo({ path: () => `/play/${props.mode}` });
</script>

<template>
  <article class="content-page">
    <header class="article-hero play-intro">
      <div>
        <h1>{{ page.heading }}</h1>
        <p class="article-lead">{{ page.intro }}</p>
        <div class="play-actions">
          <router-link v-for="(action, index) in page.actions" :key="action.href"
            :to="action.href" class="button" :class="{ primary: index === 0 }">{{ action.label }}</router-link>
        </div>
      </div>
      <ModeBoardPreview :mode="mode" />
    </header>
    <section v-for="section in page.sections" :key="section.heading" class="article-section">
      <h2>{{ section.heading }}</h2>
      <p v-for="paragraph in section.paragraphs" :key="paragraph">{{ paragraph }}</p>
    </section>
    <router-link :to="i18n.localizedPage('/rules/multiplayer')">
      {{ i18n.locale === 'en' ? 'Full rules of 3- and 4-player chess' : 'Полные правила шахмат на троих и четверых' }}
    </router-link>
  </article>
</template>

<style scoped>
.play-intro { display: grid; grid-template-columns: minmax(0, 1fr) minmax(180px, 240px); align-items: center; }
.play-intro .article-lead { margin: 12px 0 18px; }
.play-actions { display: flex; flex-wrap: wrap; gap: 8px; }
@media (max-width: 640px) {
  .play-intro { grid-template-columns: minmax(0, 1fr); }
}
</style>
