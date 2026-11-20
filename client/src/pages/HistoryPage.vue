<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { GAME_MODES, modeLabel, TIME_PRESETS, type GameSummary } from 'shared';
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router';
import { api, ApiError } from '../api/rest';
import { useAuthStore } from '../stores/auth';
import { useI18n } from '../stores/i18n';
import { usePageSeo } from '../composables/useSeo';
import MatchCard from '../components/MatchCard.vue';
import GameReplayModal from '../components/GameReplayModal.vue';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const i18n = useI18n();
const en = computed(() => i18n.locale === 'en');
const txt = (ru: string, english: string) => en.value ? english : ru;
usePageSeo({ canonical: '/history' });
const stringParam = (key: string) => typeof route.query[key] === 'string' ? String(route.query[key]) : '';
const oneOf = (key: string, choices: readonly string[]) => choices.includes(stringParam(key)) ? stringParam(key) : '';
const validId = (value: string) => /^\d+$/.test(value) && Number(value) > 0 && Number(value) <= 2147483647;
const dateParam = (key: string) => /^\d{4}-\d{2}-\d{2}$/.test(stringParam(key)) ? stringParam(key) : '';
function readFilters() {
  const player = stringParam('player').trim().slice(0, 30);
  const rawPlayerId = stringParam('playerId');
  const playerId = validId(rawPlayerId) ? rawPlayerId : '';
  const tab = oneOf('tab', ['mine', 'all']) || (playerId || player ? 'all' : auth.user ? 'mine' : 'all');
  const rawGameId = stringParam('gameId');
  const rawClock = stringParam('clock');
  return {
    tab, player, playerId,
    mode: oneOf('mode', GAME_MODES),
    opponents: oneOf('opponents', ['all-human', 'with-bots', 'humans', 'bots']),
    kind: oneOf('kind', ['rated', 'training']),
    result: oneOf('result', tab === 'mine' ? ['win', 'loss', 'draw', 'abandoned'] : ['draw', 'abandoned']),
    status: oneOf('status', ['active', 'finished', 'abandoned']),
    clock: /^(timed|untimed|\d{1,3}\+\d{1,3})$/.test(rawClock) ? rawClock : '',
    gameId: validId(rawGameId) ? rawGameId : '',
    from: dateParam('from'), to: dateParam('to'),
  };
}
const applied = computed(readFilters);
const draft = ref(readFilters());
const moreFilters = ref(Boolean(draft.value.kind || draft.value.opponents || draft.value.result || draft.value.clock || draft.value.from || draft.value.to));
const clockPresets = TIME_PRESETS.flatMap(({ tc }) => tc.kind === 'clock' ? [`${tc.baseMin}+${tc.incSec}`] : []);
const clockChoices = computed(() => [...new Set(['1+0', '3+0', ...clockPresets, ...([draft.value.clock].filter(c => c.includes('+')))])]);
const formError = ref('');
function apply() {
  formError.value = '';
  if (draft.value.from && draft.value.to && draft.value.from > draft.value.to) {
    formError.value = txt('Дата окончания диапазона раньше начальной.', 'The end of the date range is before its start.');
    return;
  }
  if (draft.value.gameId && !validId(draft.value.gameId.trim())) {
    formError.value = txt('Введите положительный ID партии.', 'Enter a positive match ID.');
    return;
  }
  const query: LocationQueryRaw = {};
  if (route.query.lang) query.lang = route.query.lang;
  for (const [key, value] of Object.entries(draft.value)) {
    if (value.trim()) query[key] = value.trim();
  }
  if (router.resolve({ path: '/history', query }).fullPath === route.fullPath) return void load();
  void router.push({ path: '/history', query });
}
function setTab(tab: string) {
  if (draft.value.tab === tab) return;
  draft.value.tab = tab;
  if (tab === 'all' && ['win', 'loss'].includes(draft.value.result)) draft.value.result = '';
  apply();
}
function reset() {
  for (const key of Object.keys(draft.value) as (keyof typeof draft.value)[]) {
    if (key !== 'tab') draft.value[key] = '';
  }
  apply();
}
const games = ref<GameSummary[]>([]);
const loading = ref(false);
const error = ref(false);
const authError = ref<401 | 403 | null>(null);
const nextCursor = ref<number | null>(null);
const replayId = ref<number | null>(null);
const loginLink = computed(() => ({ name: 'login', query: {
  redirect: route.fullPath,
  ...(authError.value === 403 && auth.user?.isGuest ? { claim: '1' } : {}),
} }));
let version = 0;
async function load(more = false) {
  const current = ++version;
  loading.value = true;
  error.value = false;
  authError.value = null;
  if (!more) { games.value = []; nextCursor.value = null; }
  const { tab, ...filters } = applied.value;
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
  if (more && nextCursor.value) query.set('cursor', String(nextCursor.value));
  try {
    const res = await api.get<{ games: GameSummary[]; nextCursor: number | null }>(`/api/games/${tab === 'mine' ? 'mine' : 'archive'}?${query}`);
    if (current !== version) return;
    games.value = more ? [...games.value, ...res.games] : res.games;
    nextCursor.value = res.nextCursor;
  } catch (e) {
    if (current !== version) return;
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
      authError.value = e.status; games.value = []; nextCursor.value = null;
    } else error.value = true;
  } finally { if (current === version) loading.value = false; }
}
watch(() => route.fullPath, () => { draft.value = readFilters(); void load(); }, { immediate: true });
onBeforeUnmount(() => { ++version; });
</script>
<template>
  <section class="panel history-panel">
    <div class="panel-head">
      <h1>{{ en ? "Match history" : "История партий" }}</h1>
    </div>
    <div class="history-controls">
      <div role="group" :aria-label="txt('Область архива', 'Archive scope')" class="scope-tabs">
        <button :class="{ primary: applied.tab === 'mine' }" :aria-pressed="applied.tab === 'mine'" @click="setTab('mine')">{{ txt('Мои партии', 'My games') }}</button>
        <button :class="{ primary: applied.tab === 'all' }" :aria-pressed="applied.tab === 'all'" @click="setTab('all')">{{ txt('Партии клуба', 'Club games') }}</button>
      </div>
      <form @submit.prevent="apply">
        <div class="filters">
          <label>{{ txt('Участник', 'Participant') }}<input v-model="draft.player" type="search" maxlength="30" :placeholder="txt('Ник участника', 'Username')" @input="draft.playerId = ''" /></label>
          <label>{{ txt('ID партии', 'Match ID') }}<input v-model.trim="draft.gameId" type="text" inputmode="numeric" maxlength="10" placeholder="155" /></label>
          <label>{{ txt('Режим', 'Mode') }}<select v-model="draft.mode"><option value="">{{ txt('Все режимы', 'All modes') }}</option><option v-for="mode in GAME_MODES" :key="mode" :value="mode">{{ modeLabel(mode, i18n.locale) }}</option></select></label>
          <label>{{ txt('Статус', 'Status') }}<select v-model="draft.status"><option value="">{{ txt('Любой', 'Any') }}</option><option value="active">{{ txt('Идёт игра', 'In progress') }}</option><option value="finished">{{ txt('Завершена', 'Finished') }}</option><option value="abandoned">{{ txt('Прервана', 'Abandoned') }}</option></select></label>
        </div>
        <details :open="moreFilters" @toggle="moreFilters = ($event.target as HTMLDetailsElement).open">
          <summary>{{ txt('Дополнительные фильтры', 'More filters') }}</summary>
          <div class="filters">
            <label>{{ txt('Участники', 'Composition') }}<select v-model="draft.opponents"><option value="">{{ txt('Любой состав', 'Any composition') }}</option><option value="all-human">{{ txt('Только люди', 'Humans only') }}</option><option value="with-bots">{{ txt('Есть бот', 'Includes a bot') }}</option><option v-if="draft.opponents === 'humans'" value="humans">{{ txt('Люди в обеих командах', 'Humans on both teams') }}</option><option v-if="draft.opponents === 'bots'" value="bots">{{ txt('Против команды ботов', 'Against a bot team') }}</option></select></label>
            <label>{{ txt('Тип партии', 'Rating type') }}<select v-model="draft.kind"><option value="">{{ txt('Все', 'All') }}</option><option value="rated">{{ txt('Рейтинговые', 'Rated') }}</option><option value="training">{{ txt('Тренировочные', 'Training') }}</option></select></label>
            <label>{{ txt('Результат', 'Outcome') }}<select v-model="draft.result"><option value="">{{ txt('Любой', 'Any') }}</option><template v-if="draft.tab === 'mine'"><option value="win">{{ txt('Победа', 'Win') }}</option><option value="loss">{{ txt('Поражение', 'Loss') }}</option></template><option value="draw">{{ txt('Ничья', 'Draw') }}</option><option v-if="draft.result === 'abandoned'" value="abandoned">{{ txt('Прервана', 'Abandoned') }}</option></select></label>
            <label>{{ txt('Контроль времени', 'Time control') }}<select v-model="draft.clock"><option value="">{{ txt('Любой', 'Any') }}</option><option value="timed">{{ txt('С часами', 'Timed') }}</option><option value="untimed">{{ txt('Без часов', 'Untimed') }}</option><option v-for="clock in clockChoices" :key="clock" :value="clock">{{ clock }}</option></select></label>
            <label>{{ txt('Начата с (UTC)', 'Started from (UTC)') }}<input v-model="draft.from" type="date" /></label>
            <label>{{ txt('Начата по (UTC)', 'Started through (UTC)') }}<input v-model="draft.to" type="date" /></label>
          </div>
        </details>
        <p v-if="formError" class="error-text" role="alert">{{ formError }}</p>
        <div class="filter-actions"><button type="submit" class="primary">{{ txt('Найти партии', 'Find games') }}</button><button type="button" class="ghost" @click="reset">{{ txt('Сбросить фильтры', 'Clear filters') }}</button></div>
      </form>
    </div>
    <div v-if="authError" class="empty" role="alert">
      <p>{{ authError === 401 ? txt('Сессия закончилась. Войдите снова, чтобы открыть архив.', 'Your session expired. Sign in again to open the archive.') : txt('Архив доступен зарегистрированным игрокам.', 'The archive is available to registered players.') }}</p>
      <router-link class="button" :to="loginLink">{{ authError === 403 && auth.user?.isGuest ? txt('Сохранить аккаунт', 'Save account') : txt('Войти', 'Sign in') }}</router-link>
    </div>
    <template v-else>
      <div v-if="error" class="empty" role="alert"><p>{{ txt('Не удалось загрузить партии. Проверьте соединение.', 'Could not load games. Check your connection.') }}</p><button @click="load()">{{ txt('Повторить', 'Try again') }}</button></div>
      <div class="match-list" :aria-busy="loading"><MatchCard v-for="game in games" :key="game.id" :game="game" :viewer-id="auth.user?.id" @replay="replayId = $event" /></div>
      <p v-if="loading" class="empty" role="status">{{ txt('Загрузка…', 'Loading…') }}</p>
      <p v-else-if="!games.length && !error" class="empty">{{ txt('По выбранным фильтрам партий пока нет.', 'No games match these filters.') }}</p>
      <div v-if="nextCursor && !error" class="empty"><button :disabled="loading" @click="load(true)">{{ txt('Показать ещё', 'Load more') }}</button></div>
    </template>
    <GameReplayModal
      v-if="replayId !== null"
      :game-id="replayId"
      :title="`${en ? 'Game' : 'Партия'} #${replayId}`"
      @close="replayId = null"
    />
  </section>
</template>
<style scoped>
h1 {
  font-size: 22px;
}
.history-controls {
  padding: 16px;
}
.scope-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.filters label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 13px;
  flex: 1 1 150px;
}
.filters select,
.filters input {
  width: 100%;
  min-width: 0;
}
.match-list {
  display: grid;
  gap: 14px;
  padding: 0 16px 16px;
}
.history-controls details { margin-top: 12px; }
.history-controls summary { cursor: pointer; color: var(--ink-2); padding: 6px 0; }
.history-controls details .filters { margin-top: 8px; }
.filter-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.filters input, .filters select { min-width: 0; min-height: 40px; }
</style>
