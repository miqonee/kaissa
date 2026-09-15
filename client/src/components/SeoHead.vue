<script setup lang="ts">
import { usePageSeo } from '../composables/useSeo';

const props = defineProps<{
  title?: string;
  description?: string;
  keywords?: string | string[];
  canonical?: string;
  path?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogUrl?: string;
  twitterCard?: 'summary' | 'summary_large_image' | 'app' | 'player';
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  noindex?: boolean;
}>();

usePageSeo(props);
</script>

<template>
  <!-- Renderless SEO Meta Head Component -->
</template>
