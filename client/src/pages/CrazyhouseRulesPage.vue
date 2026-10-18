<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '../stores/i18n';
import { usePageSeo } from '../composables/useSeo';
import content from '../content/crazyhouse.json';
import CrazyhouseExample from '../components/CrazyhouseExample.vue';
const i18n = useI18n();
const t = computed(() => content[i18n.locale]);
usePageSeo({ title: computed(() => t.value.title), description: computed(() => t.value.description), canonical: '/rules/crazyhouse', canonicalLocale: computed(() => i18n.locale) });
</script>
<template>
  <article class="crazyhouse-rules">
    <nav class="dim"><router-link to="/">{{ i18n.locale === 'en' ? 'Home' : 'Главная' }}</router-link> / Crazyhouse</nav>
    <header><h1>{{ t.heading }}</h1><p>{{ t.intro }}</p><div class="play-links"><router-link class="primary" to="/?action=quick&mode=crazyhouse">{{ t.playSolo }}</router-link><router-link class="brass" to="/?action=quick&mode=crazyhouse-team">{{ t.playTeam }}</router-link></div></header>
    <section class="panel text-section"><h2>{{ t.formatsTitle }}</h2><p>{{ t.solo }}</p><p>{{ t.team }}</p><p>{{ t.difference }} <router-link to="/rules/bughouse">{{ i18n.locale === 'en' ? 'Bughouse rules' : 'Правила багхауса' }}</router-link></p></section>
    <section class="panel text-section"><h2>{{ t.rulesTitle }}</h2><ul><li v-for="rule in t.rules" :key="rule">{{ rule }}</li></ul></section>
    <section><h2>{{ t.examplesTitle }}</h2><div class="examples"><CrazyhouseExample v-for="(_, i) in t.examples" :key="i" :scenario="i" /></div></section>
    <section class="panel text-section"><h2>{{ t.endTitle }}</h2><p>{{ t.end }}</p></section>
    <section class="panel text-section"><h2>{{ t.startTitle }}</h2><p>{{ t.start }}</p><div class="play-links"><router-link class="primary" to="/?action=quick&mode=crazyhouse">{{ t.playSolo }}</router-link><router-link class="brass" to="/?action=quick&mode=crazyhouse-team">{{ t.playTeam }}</router-link></div><p><router-link to="/rules/duo">{{ i18n.locale === 'en' ? 'One-board team chess without reserves' : 'Командные шахматы без резерва' }}</router-link> · <a href="https://lichess.org/variant/crazyhouse" target="_blank" rel="noopener noreferrer">{{ i18n.locale === 'en' ? 'Standard Crazyhouse rules on Lichess' : 'Правила стандартного Crazyhouse на Lichess' }}</a></p></section>
  </article>
</template>
<style scoped>
.crazyhouse-rules { max-width: 1040px; margin: 0 auto; padding: 24px 0; }
header { max-width: 820px; margin: 24px 0; } h1 { font-size: clamp(28px, 5vw, 42px); line-height: 1.2; }
p, li { line-height: 1.75; color: var(--ink-2); } li { margin-bottom: 10px; }
section { margin: 28px 0; } .text-section { padding: clamp(18px, 3vw, 28px); } h2 { margin-top: 0; }
.play-links { display: flex; gap: 12px; flex-wrap: wrap; margin: 20px 0; }.play-links a { text-decoration: none; }
.examples { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
@media (max-width: 700px) { .examples { grid-template-columns: 1fr; } }
</style>
