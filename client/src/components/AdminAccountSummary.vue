<script setup lang="ts">
import { computed } from 'vue';
import type { AdminAccountCounts } from 'shared';

const props = defineProps<{ counts: AdminAccountCounts; english: boolean }>();
const values = computed(() => [
  { kind: 'humans', value: props.counts.registered + props.counts.guests, label: props.english ? 'Non-bot accounts' : 'Аккаунты без ботов' },
  { kind: 'registered', value: props.counts.registered, label: props.english ? 'Registered' : 'Зарегистрированные' },
  { kind: 'guests', value: props.counts.guests, label: props.english ? 'Guests' : 'Гости' },
  { kind: 'bots', value: props.counts.bots, label: props.english ? 'Bots (separate)' : 'Боты (отдельно)' },
  { kind: 'online', value: props.counts.online, label: props.english ? 'Online (no bots)' : 'Онлайн без ботов' },
]);
const numberFormat = computed(() => new Intl.NumberFormat(props.english ? 'en-US' : 'ru-RU'));
</script>

<template>
  <dl class="account-counts" :aria-label="english ? 'All saved accounts and current presence' : 'Все сохранённые аккаунты и текущий онлайн'">
    <div v-for="item in values" :key="item.kind" :class="item.kind">
      <dt>{{ item.label }}</dt>
      <dd class="mono">{{ numberFormat.format(item.value) }}</dd>
    </div>
  </dl>
</template>

<style scoped>
.account-counts {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
}
.account-counts > div {
  display: grid;
  align-content: space-between;
  gap: 4px;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: var(--r-m);
  background: var(--surface);
}
.account-counts .humans { background: var(--surface-2); }
.account-counts dt { color: var(--ink-2); font-size: 12px; overflow-wrap: anywhere; }
.account-counts dd { margin: 0; color: var(--ink); font-size: 21px; font-weight: 650; line-height: 1.25; }
@media (max-width: 760px) {
  .account-counts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .account-counts .humans { grid-column: 1 / -1; }
}
</style>
