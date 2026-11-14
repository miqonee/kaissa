<script setup lang="ts">
import { computed } from 'vue';
import content from '../content/seo-pages.json';
import { useI18n } from '../stores/i18n';
import { usePageSeo } from '../composables/useSeo';
import ModeBoardPreview from '../components/ModeBoardPreview.vue';

const i18n = useI18n();
const page = computed(() => content['/rules/double'][i18n.locale]);
usePageSeo({ path: '/rules/double' });
</script>

<template>
  <article class="content-page double-rules">
    <nav class="breadcrumbs" :aria-label="i18n.locale === 'en' ? 'Breadcrumbs' : 'Навигация'"><router-link to="/">{{ i18n.locale === 'en' ? 'Home' : 'Главная' }}</router-link><span aria-hidden="true"> / </span><span aria-current="page">{{ i18n.locale === 'en' ? 'Double Chess' : 'Двойные шахматы' }}</span></nav>
    <header class="article-hero"><span class="badge">16×8 · 2×2</span><h1>{{ page.heading }}</h1><p class="article-lead">{{ page.intro }}</p></header>
    <figure class="double-preview"><ModeBoardPreview mode="double" /><figcaption>{{ i18n.locale === 'en' ? 'Four armies share one field. Yellow and Red are allies; Green and Blue are allies.' : 'Четыре армии на одном поле. Жёлтые и красные — союзники, зелёные и синие — союзники.' }}</figcaption></figure>
    <section v-for="section in page.sections" :key="section.heading" class="article-section"><h2>{{ section.heading }}</h2><p v-for="paragraph in section.paragraphs" :key="paragraph">{{ paragraph }}</p></section>
    <p class="source-link">{{ i18n.locale === 'en' ? 'Based on' : 'Основа режима —' }} <a href="https://greenchess.net/rules.php?v=double-four" target="_blank" rel="noopener noreferrer">Double Chess · Green Chess</a>. {{ i18n.locale === 'en' ? 'Kaissa’s clock, en passant and resignation conventions are described above.' : 'Особенности времени, взятия на проходе и сдачи в Каиссе описаны выше.' }}</p>
    <div class="double-actions"><router-link class="button primary" to="/?action=quick&mode=double">{{ i18n.locale === 'en' ? 'Play Double Chess' : 'Играть в Двойные шахматы' }}</router-link><router-link to="/rules/duo">{{ i18n.locale === 'en' ? 'Alternating 2v2 rules' : 'Правила обычного 2×2' }}</router-link><router-link to="/rules/bughouse">{{ i18n.locale === 'en' ? 'Bughouse rules' : 'Правила багхауса' }}</router-link></div>
  </article>
</template>

<style scoped>
.double-preview { max-width: 850px; margin: 24px auto; padding: 20px; border-radius: var(--r-m); background: var(--surface-inset); border: 1px solid var(--line); }
figcaption, .source-link { color: var(--ink-2); font-size: 12px; line-height: 1.6; margin-top: 14px; }
.double-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 20px; padding: 24px 0; }
</style>
