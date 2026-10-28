<script setup lang="ts">
import type { SortDirection } from '../composables/useTableSort';
defineProps<{ direction?: SortDirection; numeric?: boolean }>();
defineEmits<{ sort: [] }>();
</script>

<template>
  <th scope="col" :aria-sort="direction || 'none'" :class="{ numeric }">
    <button type="button" class="sort-button" @click="$emit('sort')">
      <span><slot /></span>
      <span class="sort-arrow" aria-hidden="true">{{ direction === 'ascending' ? '↑' : direction === 'descending' ? '↓' : '↕' }}</span>
    </button>
  </th>
</template>

<style scoped>
.sort-button { display: inline-flex; align-items: center; justify-content: inherit; gap: 5px; width: 100%; min-height: 32px; padding: 0; border: 0; border-radius: 3px; background: transparent; box-shadow: none; color: inherit; font: inherit; letter-spacing: inherit; text-transform: inherit; text-align: inherit; }
.sort-button:hover { color: var(--ink); background: transparent; }
.sort-button:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.sort-arrow { opacity: .6; font-size: 13px; }
th[aria-sort='ascending'] .sort-arrow, th[aria-sort='descending'] .sort-arrow { opacity: 1; color: var(--accent); }
th.numeric { text-align: right; }
.numeric .sort-button { justify-content: flex-end; }
</style>
