<script setup lang="ts">
import { computed } from 'vue';
import { formatGameClock } from '../game/clockDisplay';

// Read the ticking source inside this small component, never in the page's
// render function. Computed stability also skips renders within the same
// displayed second (or tenth in time trouble).
const props = withDefaults(defineProps<{
  read: () => number | null | undefined;
  tag?: 'span' | 'div' | 'strong';
  warnLow?: boolean;
}>(), { tag: 'span', warnLow: false });
const text = computed(() => formatGameClock(props.read()));
const low = computed(() => props.warnLow && (props.read() ?? Infinity) < 20_000);
</script>

<template>
  <component :is="tag" :class="{ low }">{{ text }}</component>
</template>
