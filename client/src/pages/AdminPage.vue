<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { fmtDuration, GAME_MODES, modeLabel, type GameMode, type AdminUserRow, type AdminUserDetail, type AdminUserSearchResult, type AdminAccountCounts, type AdminGameRow, type AdminActivityPeriod, type PlatformMetrics } from 'shared';
import { api } from '../api/rest';
import { useAuthStore } from '../stores/auth';
import { useI18n } from '../stores/i18n';
import SortableHeader from '../components/SortableHeader.vue';
import { useTableSort } from '../composables/useTableSort';
import AppIcon from '../components/AppIcon.vue';
import AdminAccountSummary from '../components/AdminAccountSummary.vue';
import AdminSelect from '../components/AdminSelect.vue';
import { usePageSeo } from '../composables/useSeo';

const i18n = useI18n();

usePageSeo({
  title: computed(() => (i18n.locale === 'en' ? `Admin Dashboard | ${i18n.t.nav.brand}` : 'Панель администратора | Каисса')),
  canonical: '/admin',
  noindex: true,
});

const auth = useAuthStore();
const users = ref<AdminUserDetail[]>([]);
const metrics = ref<PlatformMetrics | null>(null);
const loading = ref(true);
const error = ref('');
const busyId = ref<number | null>(null);
const botViewMode = ref<'levels' | 'personalities'>('levels');
const botTab = ref<'human' | 'bot'>('human');

const currentLevelMetrics = computed(() => {
  if (!metrics.value) return [];
  return botTab.value === 'human'
    ? (metrics.value.botMetricsVsHuman || metrics.value.botMetrics || [])
    : (metrics.value.botMetricsVsBot || []);
});

const currentPersonalityMetrics = computed(() => {
  if (!metrics.value) return [];
  return botTab.value === 'human'
    ? (metrics.value.personalityMetricsVsHuman || [])
    : (metrics.value.personalityMetricsVsBot || []);
});

const displayedLevelMetrics = computed(() => {
  if (botTab.value === 'human') {
    return currentLevelMetrics.value.filter((b) => b.totalGames > 0);
  }
  return currentLevelMetrics.value;
});

const displayedPersonalityMetrics = computed(() => {
  if (botTab.value === 'human') {
    return currentPersonalityMetrics.value.filter((p) => p.totalGames > 0);
  }
  return currentPersonalityMetrics.value;
});

const userSort = useTableSort(users, {
  id: u => u.id, online: u => u.online, username: u => u.username,
  rating: u => u.rating, results: u => [u.wins, u.losses], games: u => u.games,
  createdAt: u => Date.parse(u.createdAt), role: u => u.isGuest ? 0 : u.isAdmin ? 2 : 1,
}, 'id');
const levelSort = useTableSort(displayedLevelMetrics, {
  level: b => b.level, elo: b => b.elo, games: b => b.totalGames,
  results: b => [b.wins, b.losses, b.draws], score: b => b.winRate,
  endings: b => [b.checkmateCount, b.timeoutCount, b.stalemateCount], moves: b => b.avgMoves,
}, 'level');
const personalitySort = useTableSort(displayedPersonalityMetrics, {
  name: p => p.name, games: p => p.totalGames,
  results: p => [p.wins, p.losses, p.draws], score: p => p.winRate,
  endings: p => [p.checkmateCount, p.timeoutCount, p.stalemateCount], moves: p => p.avgMoves,
}, 'name');
const metricColumns = [['games', 'Игр'], ['results', 'В / П / Н'], ['score', 'Очки'], ['endings', 'М / Ф / П'], ['moves', 'Ср. ходов']];
const metricTitles: Record<string, string> = { results: 'Сортировка по победам, затем поражениям и ничьим', endings: 'Сортировка по матам, затем флагам и патам', score: 'Очки = (победы + 0.5 × ничьи) / игры', moves: 'Среднее число полуходов в партии' };

const topLevel = computed(() => {
  const list = currentLevelMetrics.value.filter((l) => l.totalGames >= 5 && l.winRate > 0);
  if (!list.length) return null;
  return list.slice().sort((a, b) => b.winRate - a.winRate || b.totalGames - a.totalGames)[0];
});

const topPersonality = computed(() => {
  const list = currentPersonalityMetrics.value.filter((p) => p.totalGames >= 5 && p.winRate > 0);
  if (!list.length) return null;
  return list.slice().sort((a, b) => b.winRate - a.winRate || b.totalGames - a.totalGames)[0];
});

const bestPair = computed(() => {
  const p = metrics.value?.bestPair;
  return p && p.totalGames >= 5 && p.winRate > 0 ? p : null;
});

const worstPair = computed(() => {
  const p = metrics.value?.worstPair;
  return p && p.totalGames >= 5 ? p : null;
});

type Tab = 'overview' | 'games' | 'users' | 'bots';
const tab = ref<Tab>('overview');
const en = computed(() => i18n.locale === 'en');
const txt = (ru: string, english: string) => en.value ? english : ru;
const gameStatusOptions = computed(() => [
  { value: 'all', label: txt('Все статусы', 'All statuses') },
  { value: 'active', label: txt('Активные', 'Active') },
  { value: 'finished', label: txt('Завершённые', 'Finished') },
  { value: 'abandoned', label: txt('Прерванные', 'Abandoned') },
]);
const gameModeOptions = computed(() => [
  { value: 'all', label: txt('Все режимы', 'All modes') },
  ...GAME_MODES.map(value => ({ value, label: modeLabel(value, i18n.locale) })),
]);
const gameClockOptions = computed(() => [
  { value: 'all', label: txt('Любые часы', 'Any clock') },
  { value: 'timed', label: txt('С часами', 'Timed') },
  { value: 'untimed', label: txt('Без часов', 'Untimed') },
]);
const userKindOptions = computed(() => [
  { value: 'all', label: txt('Игроки и гости', 'Players & guests') },
  { value: 'registered', label: txt('Зарегистрированные', 'Registered') },
  { value: 'guest', label: txt('Гости', 'Guests') },
  { value: 'admin', label: txt('Администраторы', 'Administrators') },
]);
const userOnlineOptions = computed(() => [
  { value: 'all', label: txt('Любой статус', 'Any status') },
  { value: 'online', label: txt('Онлайн', 'Online') },
  { value: 'offline', label: txt('Офлайн', 'Offline') },
]);
const numberFormat = computed(() => new Intl.NumberFormat(en.value ? 'en-US' : 'ru-RU'));
const fmtNumber = (n: number) => numberFormat.value.format(n);
const roleLabel = (user: AdminUserRow) => user.isGuest ? txt('Гость', 'Guest')
  : user.isAdmin ? txt('Админ', 'Admin') : txt('Игрок', 'Player');
const userColumns = computed(() => [
  ['id', 'ID'], ['online', txt('Статус', 'Status')], ['username', txt('Имя', 'Username')], ['rating', txt('Рейтинг', 'Rating')],
  ['results', txt('В / П', 'W / L')], ['games', txt('Партий', 'Matches')], ['createdAt', txt('Создан', 'Created')], ['role', txt('Роль', 'Role')],
]);
const tabs = computed(() => [
  { id: 'overview' as Tab, label: txt('Обзор', 'Overview') },
  { id: 'games' as Tab, label: txt('Партии', 'Matches') },
  { id: 'users' as Tab, label: txt('Игроки и гости', 'Players & guests') },
  { id: 'bots' as Tab, label: txt('Боты', 'Bots') },
]);
const updatedAt = ref<Date | null>(null);
const period = ref<AdminActivityPeriod>('30');
const periods: AdminActivityPeriod[] = ['7', '30', 'all'];
const activity = computed(() => metrics.value?.activity);
const activityShares = computed(() => {
  const a = activity.value;
  if (!a?.started) return [];
  return [
    { key: 'finished', value: a.finished },
    { key: 'abandoned', value: a.abandoned },
    { key: 'active', value: a.active },
  ];
});
const botMetricsLoaded = ref(false);
const adminModeLabel = (mode: string) => GAME_MODES.includes(mode as GameMode) ? modeLabel(mode as GameMode, i18n.locale) : mode;
const userQuery = ref('');
const userKind = ref('all');
const userOnline = ref('all');
const userPage = ref(1);
const userPages = ref(1);
const userTotal = ref(0);
const userAccounts = ref<AdminAccountCounts | null>(null);
const userPageSize = ref(25);
const userVisibleRange = computed(() => {
  const first = (userPage.value - 1) * userPageSize.value + 1;
  return `${fmtNumber(first)}–${fmtNumber(first + users.value.length - 1)}`;
});
const userLoading = ref(false);
const userError = ref('');
const selectedUser = ref<AdminUserDetail | null>(null);
const showDanger = ref(false);
const actionError = ref('');
const games = ref<AdminGameRow[]>([]);
const gameQuery = ref('');
const gameStatus = ref('all');
const gameMode = ref('all');
const gameClock = ref('all');
const gamePage = ref(1);
const gamePages = ref(1);
const gameTotal = ref(0);
const gameLoading = ref(false);
const gameError = ref('');
const selectedGame = ref<AdminGameRow | null>(null);
const pageSize = 25;
let usersVersion = 0;
let gamesVersion = 0;
let metricsVersion = 0;
async function loadUsers(page = 1) {
  const version = ++usersVersion;
  userLoading.value = true;
  userError.value = '';
  selectedUser.value = null;
  showDanger.value = false;
  const query = new URLSearchParams({ q: userQuery.value.trim(), kind: userKind.value, online: userOnline.value, page: String(page), pageSize: String(pageSize) });
  try {
    const res = await api.get<AdminUserSearchResult>(`/api/admin/users/search?${query}`);
    if (version !== usersVersion) return;
    // Deletion or a presence change can remove the last page between requests.
    if (!res.users.length && res.page > Math.max(1, res.totalPages)) {
      await loadUsers(Math.max(1, res.totalPages));
      return;
    }
    users.value = res.users; userPage.value = res.page; userPages.value = res.totalPages; userTotal.value = res.total;
    userPageSize.value = res.pageSize;
    userAccounts.value = res.accounts;
  } catch (e) { if (version === usersVersion) userError.value = e instanceof Error ? e.message : txt('Ошибка загрузки игроков', 'Failed to load players'); }
  finally { if (version === usersVersion) userLoading.value = false; }
}
async function loadGames(page = 1) {
  const version = ++gamesVersion;
  gameLoading.value = true; gameError.value = ''; selectedGame.value = null;
  const query = new URLSearchParams({ q: gameQuery.value.trim(), status: gameStatus.value, mode: gameMode.value, clock: gameClock.value, page: String(page), pageSize: String(pageSize) });
  try {
    const res = await api.get<{ games: AdminGameRow[]; page: number; totalPages: number; total: number }>(`/api/admin/games?${query}`);
    if (version !== gamesVersion) return;
    games.value = res.games; gamePage.value = res.page; gamePages.value = res.totalPages; gameTotal.value = res.total;
  } catch (e) { if (version === gamesVersion) gameError.value = e instanceof Error ? e.message : txt('Ошибка загрузки партий', 'Failed to load matches'); }
  finally { if (version === gamesVersion) gameLoading.value = false; }
}
async function loadData() {
  const version = ++metricsVersion;
  loading.value = true; error.value = '';
  try {
    const full = tab.value === 'bots';
    const res = await api.get<PlatformMetrics>(full ? '/api/admin/metrics' : `/api/admin/metrics?scope=overview&period=${period.value}`);
    if (version !== metricsVersion) return;
    metrics.value = res; botMetricsLoaded.value = full; updatedAt.value = new Date();
  } catch (e) { if (version === metricsVersion) error.value = e instanceof Error ? e.message : txt('Ошибка загрузки метрик', 'Failed to load metrics'); }
  finally { if (version === metricsVersion) loading.value = false; }
}
function refresh() {
  if (tab.value === 'users') void loadUsers(userPage.value);
  else if (tab.value === 'games') void loadGames(gamePage.value);
  else void loadData();
}
watch(tab, value => {
  selectedUser.value = null; selectedGame.value = null; showDanger.value = false; actionError.value = '';
  if (value === 'users') void loadUsers();
  if (value === 'games') void loadGames();
  if (value === 'bots' && !botMetricsLoaded.value) void loadData();
  if (value === 'overview') void loadData();
});
watch(period, () => { if (tab.value === 'overview') void loadData(); });
onMounted(loadData);
onBeforeUnmount(() => { ++usersVersion; ++gamesVersion; ++metricsVersion; });
async function selectUser(user: AdminUserDetail) {
  selectedUser.value = user; showDanger.value = false; actionError.value = '';
  await nextTick();
  document.querySelector<HTMLElement>('.account-detail')?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
}
const statusLabel = (status: string) => ({ active: txt('Идёт игра', 'Active'), finished: txt('Завершена', 'Finished'), abandoned: txt('Прервана', 'Abandoned') }[status] ?? status);
const ratingKindLabel = (kind: string | null) => ({ rated: txt('Рейтинговая', 'Rated'), guest: txt('Тренировка · с гостем', 'Training · with guest'), bots: txt('Тренировка · с ботами', 'Training · with bots'), training: txt('Тренировка', 'Training') }[kind ?? ''] ?? txt('Архив · прежний рейтинг', 'Archive · former rating'));
const reasonLabel = (reason: string | null) => ({ checkmate: txt('Мат', 'Checkmate'), resign: txt('Сдача', 'Resignation'), timeout: txt('Время истекло', 'Timeout'), stalemate: txt('Пат', 'Stalemate'), material: txt('Недостаточно материала', 'Insufficient material'), repetition: txt('Повторение позиции', 'Repetition'), fifty: txt('Правило 50 ходов', '50-move rule'), abandoned: txt('Партия прервана', 'Interrupted'), 'last-standing': txt('Последний выживший', 'Last player standing'), 'points-lead': txt('Победа по очкам', 'Victory by points') }[reason ?? ''] ?? reason ?? '—');
const warningLabel = (warning: string) => ({
  active_not_in_memory: txt('Нет активного состояния в этом процессе', 'No active state in this server process'),
  paused_with_bots: txt('Пауза темпа игры ботов', 'Bot pacing is paused'),
  offline_participant: txt('Есть отключённый участник', 'A participant is offline'),
  result_pending: txt('Результат ожидает сохранения', 'Result pending'),
}[warning] ?? warning);

async function deleteUser(u: AdminUserRow) {
  if (busyId.value !== null) return;
  if (!confirm(`Вы действительно хотите удалить аккаунт «${u.username}» и ВСЕ его партии? Они исчезнут из истории всех участников.`)) {
    return;
  }
  busyId.value = u.id;
  try {
    await api.delete(`/api/admin/users/${u.id}`);
    await Promise.all([loadUsers(userPage.value), loadData()]);
  } catch (e: any) {
    actionError.value = e.message || 'Ошибка удаления';
  } finally {
    busyId.value = null;
  }
}

async function resetRating(u: AdminUserRow) {
  if (busyId.value !== null) return;
  if (!confirm(`Сбросить рейтинг и победы игрока «${u.username}» на 1200?`)) return;
  busyId.value = u.id;
  try {
    await api.post(`/api/admin/users/${u.id}/reset`, {});
    await Promise.all([loadUsers(userPage.value), loadData()]);
  } catch (e: any) {
    actionError.value = e.message || 'Ошибка сброса';
  } finally {
    busyId.value = null;
  }
}

async function toggleAdmin(u: AdminUserRow) {
  if (busyId.value !== null) return;
  if (!confirm(txt(`${u.isAdmin ? 'Снять' : 'Предоставить'} права администратора для «${u.username}»? Это изменит доступ к управлению платформой.`, `${u.isAdmin ? 'Remove' : 'Grant'} administrator access for “${u.username}”? This changes platform management permissions.`))) return;
  busyId.value = u.id;
  try {
    await api.post(`/api/admin/users/${u.id}/admin`, { isAdmin: !u.isAdmin });
    await Promise.all([loadUsers(userPage.value), loadData()]);
  } catch (e: any) {
    actionError.value = e.message || 'Ошибка смены прав';
  } finally {
    busyId.value = null;
  }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(en.value ? 'en-US' : 'ru-RU', { day: 'numeric', month: 'short' });
}

const durationTooltip = computed(() => {
  if (!metrics.value?.durationStats) return '';
  const ds = metrics.value.durationStats;
  const lines: string[] = [];
  if (ds.timedCount > 0) {
    lines.push(`С контролем времени: ${fmtDuration(ds.timedAvgSec)} (${ds.timedCount} партий)`);
  }
  if (ds.noClockCount > 0) {
    lines.push(`Без часов: ${fmtDuration(ds.noClockAvgSec)} (${ds.noClockCount} партий)`);
  }
  if (ds.byTimeControl?.length) {
    lines.push('По контролям: ' + ds.byTimeControl.map((t) => `${t.label}: ${fmtDuration(t.avgSec)} (${t.count})`).join(', '));
  }
  if (ds.byMode?.teamSec || ds.byMode?.bughouseSec) {
    const parts: string[] = [];
    if (ds.byMode.teamSec) parts.push(`2×2: ${fmtDuration(ds.byMode.teamSec)}`);
    if (ds.byMode.bughouseSec) parts.push(`Багхаус: ${fmtDuration(ds.byMode.bughouseSec)}`);
    lines.push('По режимам: ' + parts.join(', '));
  }
  return lines.join('\n');
});

const diagnosisHeading = (game: AdminGameRow) => {
  if (game.diagnostics.pendingResult) return txt('Результат ещё не сохранён', 'Result not saved yet');
  if (game.diagnostics.paused) return txt('Партия на паузе', 'Match paused');
  if (game.status === 'active' && !game.diagnostics.inMemory) return txt('Нет живого состояния партии', 'No live match state');
  if (game.diagnostics.offlineUserIds?.length) return txt('Не все участники онлайн', 'Some participants are offline');
  return txt('Состояние партии', 'Match state');
};
function playerNames(game: AdminGameRow, ids: number[]) {
  return ids.map(id => game.participants.find(p => p.id === id)?.username ?? '#' + id).join(', ') || '—';
}
function inspectActive() {
  gameQuery.value = ''; gameMode.value = 'all'; gameClock.value = 'all';
  gameStatus.value = 'active'; tab.value = 'games';
}
</script>

<template>
  <div class="admin-page">
    <header class="admin-header">
      <div><p class="eyebrow">KAISSA / {{ txt('УПРАВЛЕНИЕ', 'OPERATIONS') }}</p><h1>{{ txt('Панель клуба', 'Club dashboard') }}</h1><p class="hint">{{ txt('Состояние платформы, партии и участники. Опасные действия отделены от просмотра.', 'Platform health, matches and members. Sensitive actions are separate from browsing.') }}</p></div>
      <button class="small ghost" :disabled="loading || userLoading || gameLoading" @click="refresh"><AppIcon name="refresh" :size="14" /> {{ txt('Обновить', 'Refresh') }}</button>
    </header>
    <nav class="admin-nav" :aria-label="txt('Разделы управления', 'Administration sections')">
      <button v-for="item in tabs" :key="item.id" :data-tab="item.id" :class="{ active: tab === item.id }" :aria-pressed="tab === item.id" @click="tab = item.id">{{ item.label }}</button>
    </nav>

    <section v-if="tab === 'overview'" class="admin-section" aria-labelledby="overview-title">
      <div class="section-heading overview-heading">
        <div><h2 id="overview-title">{{ txt('Активность клуба', 'Club activity') }}</h2><p class="hint">{{ txt('По дате старта партии. Демо не учитываются.', 'By match start date. Demos are excluded.') }}</p></div>
        <div class="period-picker" role="group" :aria-label="txt('Период активности', 'Activity period')">
          <button v-for="p in periods" :key="p" class="small ghost" :class="{ active: period === p }" :aria-pressed="period === p" @click="period = p">{{ p === 'all' ? txt('Всё время', 'All time') : p + txt(' дней', ' days') }}</button>
        </div>
      </div>
      <p v-if="error" role="alert" class="error-text">{{ error }}</p>
      <p v-if="loading" role="status" class="hint">{{ txt('Обновляем метрики…', 'Updating metrics…') }}</p>
      <template v-if="metrics && !loading && !error">
        <article v-if="activity" class="panel activity-panel">
          <div class="activity-main">
            <div><span class="hint">{{ txt('Партии за период', 'Matches in period') }}</span><strong class="metric-val mono">{{ activity.started }}</strong></div>
            <div><span class="hint">{{ txt('Люди, сделавшие ход', 'People who made a move') }}</span><strong class="metric-val mono">{{ activity.distinctHumanMovers }}</strong></div>
            <div><span class="hint">{{ txt('Записано полуходов', 'Recorded plies') }}</span><strong class="metric-val mono">{{ activity.recordedMoves }}</strong></div>
          </div>
          <div v-if="activityShares.length" class="activity-bar" aria-hidden="true">
            <div v-for="s in activityShares" :key="s.key" :class="s.key" :style="{ flexGrow: s.value }"></div>
          </div>
          <div class="activity-legend">
            <span class="finished"><i aria-hidden="true" />{{ txt('Завершены', 'Finished') }} <strong class="mono">{{ activity.finished }}</strong></span>
            <span class="abandoned"><i aria-hidden="true" />{{ txt('Прерваны', 'Interrupted') }} <strong class="mono">{{ activity.abandoned }}</strong></span>
            <button class="ghost small active" @click="inspectActive"><i aria-hidden="true" />{{ txt('Активны', 'Active') }} <strong class="mono">{{ activity.active }}</strong></button>
          </div>
          <p class="hint interrupted-split">{{ txt('Прерванные партии:', 'Interrupted matches:') }} <strong>{{ activity.abandonedWithoutMoves }}</strong> {{ txt('без ходов', 'without moves') }} · <strong>{{ activity.abandonedWithMoves }}</strong> {{ txt('с записанными ходами', 'with recorded moves') }}</p>
        </article>
        <div class="platform-totals hint" :title="updatedAt?.toLocaleTimeString(en ? 'en-US' : 'ru-RU')">
          <span>{{ txt('Партии за всё время:', 'Matches saved all time:') }} <strong class="mono">{{ fmtNumber(metrics.totalGames) }}</strong></span>
        </div>
        <AdminAccountSummary v-if="metrics.accounts" :counts="metrics.accounts" :english="en" />
        <div class="overview-details">
          <article class="panel insight-card"><h3>{{ txt('Длительность партий', 'Match duration') }}</h3><strong class="metric-val mono" :title="durationTooltip">{{ fmtDuration((metrics.durationStats?.timedCount ? metrics.durationStats.timedAvgSec : metrics.durationStats?.noClockAvgSec) ?? metrics.avgGameDurationSec) }}</strong><p class="hint">{{ txt('По последним завершённым партиям, до 200. С часами, если они есть.', 'Up to 200 recently finished matches. Timed matches when available.') }}</p>
            <dl v-if="metrics.durationStats" class="fact-list"><div><dt>{{ txt('С часами', 'Timed') }}</dt><dd>{{ fmtDuration(metrics.durationStats.timedAvgSec) }} <small class="dim">({{ metrics.durationStats.timedCount }})</small></dd></div><div><dt>{{ txt('Без часов', 'Untimed') }}</dt><dd>{{ fmtDuration(metrics.durationStats.noClockAvgSec) }} <small class="dim">({{ metrics.durationStats.noClockCount }})</small></dd></div><div v-for="control in metrics.durationStats.byTimeControl.filter(c => c.label !== 'Без часов')" :key="control.label"><dt>{{ control.label }}</dt><dd>{{ fmtDuration(control.avgSec) }} <small class="dim">({{ control.count }})</small></dd></div></dl>
          </article>
          <article class="panel insight-card"><h3>{{ txt('Быстрый переход', 'Quick access') }}</h3><button class="quick-link" @click="inspectActive"><strong>{{ txt('Активные партии', 'Active matches') }}</strong><span class="hint">{{ txt('Участники, паузы, связь с сервером', 'Participants, pauses, server state') }}</span><AppIcon name="chevron-right" :size="18" /></button><button class="quick-link" @click="userQuery = ''; userKind = 'all'; userOnline = 'online'; tab = 'users'"><strong>{{ txt('Игроки онлайн', 'Online players') }}</strong><span class="hint">{{ txt('Аккаунты, гости и рейтинги по режимам', 'Accounts, guests and ratings by mode') }}</span><AppIcon name="chevron-right" :size="18" /></button><button class="quick-link" @click="tab = 'bots'"><strong>{{ txt('Калибровка ботов', 'Bot calibration') }}</strong><span class="hint">{{ txt('Уровни, стили и командные сочетания', 'Levels, styles and team pairings') }}</span><AppIcon name="chevron-right" :size="18" /></button></article>
        </div>
      </template>
    </section>

    <section v-else-if="tab === 'games'" class="admin-section" aria-labelledby="games-title">
      <div class="section-heading"><div><h2 id="games-title">{{ txt('Партии', 'Matches') }}</h2><p class="hint">{{ txt('Сохранённые партии. Демо, которые существуют только в памяти, не включены. Диагностика относится к текущему процессу сервера.', 'Saved matches, excluding memory-only demos. Diagnostics describe the current server process.') }}</p></div><span class="badge mono">{{ gameTotal }}</span></div>
      <form class="admin-filters" @submit.prevent="loadGames()">
        <label class="search-field">{{ txt('ID партии или имя участника', 'Match ID or participant') }}<input v-model="gameQuery" type="search" :placeholder="txt('Например, 155 или ник', 'For example, 155 or username')" /></label>
        <AdminSelect v-model="gameStatus" :label="txt('Статус', 'Status')" :options="gameStatusOptions" @change="loadGames()" />
        <AdminSelect class="admin-select--wide" v-model="gameMode" :label="txt('Режим', 'Mode')" :options="gameModeOptions" @change="loadGames()" />
        <AdminSelect v-model="gameClock" :label="txt('Часы', 'Clock')" :options="gameClockOptions" @change="loadGames()" />
        <button type="submit" class="primary" :disabled="gameLoading">{{ txt('Найти', 'Search') }}</button>
      </form>
      <p v-if="gameError" role="alert" class="error-text">{{ gameError }}</p>
      <p v-if="gameLoading" role="status" class="hint">{{ txt('Загружаем партии…', 'Loading matches…') }}</p>
      <div v-else-if="!gameError && !games.length" class="admin-empty">{{ txt('Под эти условия партии не найдены. Измените фильтры.', 'No matches found. Try different filters.') }}</div>
      <div v-else-if="!gameError" class="match-list">
        <article v-for="game in games" :key="game.id" class="admin-match" :class="{ selected: selectedGame?.id === game.id }">
          <div class="match-summary"><strong class="mono">#{{ game.id }}</strong><span>{{ adminModeLabel(game.mode) }}</span><span class="badge" :class="{ on: game.status === 'active' }">{{ game.diagnostics.paused ? txt('Пауза', 'Paused') : statusLabel(game.status) }}</span><span class="hint mono">{{ game.noClock ? txt('Без часов', 'Untimed') : `${game.baseMin}+${game.incSec}` }}</span></div>
          <div class="match-people"><span v-for="player in game.participants" :key="player.id"><i class="dot" :class="{ on: player.online }" />{{ player.username }}<small v-if="player.isBot || player.isGuest" class="dim"> · {{ player.isBot ? txt('бот', 'bot') : txt('гость', 'guest') }}</small></span></div>
          <div class="match-footer"><span class="hint">{{ fmtDate(game.startedAt) }} · {{ game.moves }} {{ txt('полуходов', 'plies') }} · {{ ratingKindLabel(game.ratingKind) }}</span><span v-if="game.diagnostics.warnings.length" class="warning-text">{{ txt('Сигналов', 'Signals') }}: {{ game.diagnostics.warnings.length }}</span><button class="small" @click="selectedGame = selectedGame?.id === game.id ? null : game">{{ selectedGame?.id === game.id ? txt('Свернуть', 'Collapse') : txt('Диагностика', 'Inspect') }}</button><router-link class="small" :to="`/game/${game.id}`">{{ txt('Открыть', 'Open') }}</router-link></div>
          <div v-if="selectedGame?.id === game.id" class="diagnostics">
            <div class="diagnosis-title"><h3>{{ diagnosisHeading(game) }}</h3><span class="badge">{{ txt('Только чтение', 'Read only') }}</span></div>
            <ul v-if="game.diagnostics.warnings.length" class="diagnosis-warnings"><li v-for="warning in game.diagnostics.warnings" :key="warning" class="warning-text">{{ warningLabel(warning) }}</li></ul>
            <dl class="fact-list">
              <div v-if="game.status === 'active'"><dt>{{ txt('Участники вне сети', 'Offline participants') }}</dt><dd>{{ playerNames(game, game.diagnostics.offlineUserIds ?? []) }}</dd></div>
              <div v-if="game.diagnostics.disconnectedUserIds.length"><dt>{{ txt('Сервер отметил выход', 'Server marked disconnected') }}</dt><dd>{{ playerNames(game, game.diagnostics.disconnectedUserIds) }}</dd></div>
              <div><dt>{{ txt('Последний записанный полуход', 'Last recorded ply') }}</dt><dd v-if="game.diagnostics.lastMove">#{{ game.diagnostics.lastMove.ply }} · {{ playerNames(game, [game.diagnostics.lastMove.userId]) }}<template v-if="game.mode === 'bughouse'"> · {{ txt('доска', 'board') }} {{ game.diagnostics.lastMove.boardIndex + 1 }}</template></dd><dd v-else>—</dd></div>
              <div v-if="game.status === 'active'"><dt>{{ txt('Есть состояние в памяти сервера', 'Active state in server memory') }}</dt><dd>{{ game.diagnostics.inMemory ? txt('Да', 'Yes') : txt('Нет', 'No') }}</dd></div>
              <div v-if="game.diagnostics.waitingForHuman"><dt>{{ txt('Ожидается ход человека', 'Waiting for a human move') }}</dt><dd>{{ txt('Да', 'Yes') }}</dd></div>
              <div v-if="game.status !== 'active'"><dt>{{ txt('Результат / причина', 'Result / reason') }}</dt><dd>{{ game.result || '—' }} / {{ reasonLabel(game.reason) }}</dd></div>
            </dl>
            <p v-if="!game.diagnostics.warnings.length" class="hint">{{ txt('Диагностических сигналов нет. Это не проверка корректности всех ходов.', 'No diagnostic signals. This is not a validation of every move.') }}</p>
          </div>
        </article>
      </div>
      <div class="admin-pagination"><span class="hint">{{ txt('Страница', 'Page') }} {{ gamePage }} / {{ Math.max(1, gamePages) }} · {{ txt('по 25 партий', '25 matches per page') }}</span><button :disabled="gameLoading || gamePage <= 1" @click="loadGames(gamePage - 1)">{{ txt('Назад', 'Previous') }}</button><button :disabled="gameLoading || gamePage >= gamePages" @click="loadGames(gamePage + 1)">{{ txt('Далее', 'Next') }}</button></div>
    </section>

    <section v-else-if="tab === 'users'" class="admin-section" aria-labelledby="users-title">
      <div class="section-heading"><div><h2 id="users-title">{{ txt('Игроки и гости', 'Players & guests') }}</h2><p class="hint">{{ txt('Поиск по всем игрокам и гостям. Ботов в списке нет. Сортировка на текущей странице.', 'Search all registered and guest accounts. Bots are listed separately. Sorting applies to this page.') }}</p></div></div>
      <AdminAccountSummary v-if="userAccounts" :counts="userAccounts" :english="en" />
      <form class="admin-filters" @submit.prevent="loadUsers()"><label class="search-field">{{ txt('Имя или ID игрока', 'Username or player ID') }}<input v-model="userQuery" type="search" :placeholder="txt('Найти аккаунт', 'Find an account')" /></label><AdminSelect class="admin-select--wide" v-model="userKind" :label="txt('Тип аккаунта', 'Account type')" :options="userKindOptions" @change="loadUsers()" /><AdminSelect v-model="userOnline" :label="txt('Присутствие', 'Presence')" :options="userOnlineOptions" @change="loadUsers()" /><button type="submit" class="primary" :disabled="userLoading">{{ txt('Найти', 'Search') }}</button></form>
      <p v-if="userError" role="alert" class="error-text">{{ userError }}</p><p v-if="userLoading" role="status" class="hint">{{ txt('Загружаем игроков…', 'Loading players…') }}</p>
      <p v-else-if="!userError" class="user-result-count hint" role="status"><strong>{{ txt('Найдено:', 'Accounts found:') }} <span class="mono">{{ fmtNumber(userTotal) }}</span></strong><span v-if="users.length">{{ txt('Показаны', 'Showing') }} {{ userVisibleRange }}</span></p>
      <div v-if="!userLoading && !userError && !users.length" class="admin-empty">{{ txt('Нет подходящих аккаунтов. Измените запрос или фильтры.', 'No accounts match. Change the search or filters.') }}</div>
      <div v-else-if="!userLoading && !userError" class="table-wrap user-table" tabindex="0" :aria-label="txt('Таблица игроков, можно прокручивать', 'Scrollable players table')"><table class="club"><thead><tr><SortableHeader v-for="[key, label] in userColumns" :key="key" :direction="userSort.sortDirection(key)" @sort="userSort.sortBy(key, ['username', 'id'].includes(key) ? 'ascending' : 'descending')">{{ label }}</SortableHeader><th>{{ txt('Карточка', 'Details') }}</th></tr></thead><tbody><tr v-for="user in userSort.sortedRows.value" :key="user.id" :class="{ 'is-me': user.id === auth.user?.id, selected: selectedUser?.id === user.id }"><td class="mono dim">{{ user.id }}</td><td><span class="dot" :class="{ on: user.online }" />{{ user.online ? txt('Онлайн', 'Online') : txt('Офлайн', 'Offline') }}</td><td><router-link :to="`/players/${encodeURIComponent(user.username)}`">{{ user.username }}</router-link></td><td class="mono">{{ user.rating }}</td><td class="mono">{{ user.wins }} / {{ user.losses }}</td><td class="mono">{{ user.games }}</td><td>{{ fmtDate(user.createdAt) }}</td><td><span class="badge account-role" :class="{ 'account-role-guest': user.isGuest }">{{ roleLabel(user) }}</span></td><td><button class="small" @click="selectUser(user)">{{ txt('Открыть', 'Open') }}</button></td></tr></tbody></table></div>
      <div v-if="!userLoading && !userError" class="mobile-users">
        <article v-for="user in users" :key="user.id" class="mobile-user" :class="{ selected: selectedUser?.id === user.id }">
          <div><strong>{{ user.username }}</strong><span class="hint mono">#{{ user.id }} · {{ roleLabel(user) }}</span></div>
          <span class="hint"><i class="dot" :class="{ on: user.online }" />{{ user.online ? txt('Онлайн', 'Online') : txt('Офлайн', 'Offline') }}</span>
          <p class="hint mono">{{ user.rating }} Elo · {{ user.games }} {{ txt('партий', 'matches') }} · {{ user.wins }}/{{ user.losses }} {{ txt('В/П', 'W/L') }}</p>
          <button class="small" @click="selectUser(user)">{{ txt('Карточка игрока', 'Player details') }}</button>
        </article>
      </div>
      <div v-if="!userError && userPages > 1" class="admin-pagination"><span class="hint">{{ txt('Страница', 'Page') }} {{ fmtNumber(userPage) }} / {{ fmtNumber(userPages) }}</span><button :disabled="userLoading || userPage <= 1" @click="loadUsers(userPage - 1)">{{ txt('Назад', 'Previous') }}</button><button :disabled="userLoading || userPage >= userPages" @click="loadUsers(userPage + 1)">{{ txt('Далее', 'Next') }}</button></div>
      <article v-if="selectedUser" class="panel account-detail"><div class="section-heading"><div><h3>{{ selectedUser.username }} <small class="dim mono">#{{ selectedUser.id }}</small> <span class="badge account-role" :class="{ 'account-role-guest': selectedUser.isGuest }">{{ roleLabel(selectedUser) }}</span></h3><p class="hint">{{ txt('Аккаунт создан', 'Account created') }}: {{ fmtDate(selectedUser.createdAt) }} · {{ txt('Сохранённая отметка посещения', 'Stored last-seen timestamp') }}: {{ fmtDate(selectedUser.lastSeenAt) }}</p></div><button class="small ghost" @click="selectedUser = null">{{ txt('Закрыть', 'Close') }}</button></div><div class="detail-links"><router-link :to="{ path: '/history', query: { playerId: selectedUser.id, player: selectedUser.username } }">{{ txt('История партий', 'Match history') }}</router-link><router-link v-if="selectedUser.activeGameId" :to="`/game/${selectedUser.activeGameId}`">{{ txt('Активная партия', 'Active match') }} #{{ selectedUser.activeGameId }}</router-link></div>
        <div class="rating-cards"><div v-for="rating in selectedUser.modeRatings" :key="rating.mode"><strong>{{ adminModeLabel(rating.mode) }}</strong><span class="mono">{{ rating.rating }} Elo</span><small class="hint">{{ txt('Рейтинг В/П/Н', 'Rated W/L/D') }}: {{ rating.wins }}/{{ rating.losses }}/{{ rating.draws }}</small><small class="hint">{{ txt('Тренировки В/П/Н', 'Training W/L/D') }}: {{ rating.trainingWins }}/{{ rating.trainingLosses }}/{{ rating.trainingDraws }}</small></div></div>
        <button class="small ghost danger-reveal" :aria-expanded="showDanger" @click="showDanger = !showDanger">{{ txt('Управление аккаунтом · опасные действия', 'Account management · sensitive actions') }}</button>
        <div v-if="showDanger" class="danger-zone"><h4>{{ txt('Изменения влияют на реальные данные', 'These actions affect real data') }}</h4><p>{{ txt('Удаление аккаунта удаляет его партии из истории всех участников. Сброс изменяет рейтинг и результаты. Права администратора открывают управление платформой. Каждое действие требует отдельного подтверждения.', 'Deleting an account removes its matches from every participant’s history. Reset changes ratings and results. Administrator access grants platform management permissions. Each action requires separate confirmation.') }}</p><p v-if="actionError" role="alert" class="error-text">{{ actionError }}</p><div class="admin-actions"><button :disabled="busyId !== null" @click="resetRating(selectedUser)">{{ txt('Сбросить рейтинг на 1200', 'Reset rating to 1200') }}</button><button :disabled="busyId !== null || selectedUser.id === auth.user?.id || selectedUser.isGuest || selectedUser.isBot" @click="toggleAdmin(selectedUser)">{{ selectedUser.isAdmin ? txt('Снять права админа', 'Remove admin access') : txt('Предоставить права админа', 'Grant admin access') }}</button><button class="danger" :disabled="busyId !== null || selectedUser.id === auth.user?.id" @click="deleteUser(selectedUser)">{{ txt('Удалить аккаунт и партии', 'Delete account and matches') }}</button></div></div>
      </article>
    </section>

    <section v-else class="admin-section" aria-labelledby="bots-title">
      <p v-if="error" role="alert" class="error-text">{{ error }}</p><p v-if="loading" role="status" class="hint">{{ txt('Обновляем статистику…', 'Updating statistics…') }}</p>
      <!-- Сворачиваемый блок калибровки и статистики ботов (по умолчанию свернут) -->
      <div v-if="metrics && botMetricsLoaded" class="bot-metrics-panel">
        <div class="section-heading"><div><h2 id="bots-title">{{ txt('Калибровка и статистика ботов', 'Bot calibration & statistics') }}</h2><p class="hint">{{ txt('Здесь считаются участия ботов, а не уникальные партии. Сводки выделяются от пяти игр; это не доказательство превосходства. Сессионные демо и дуэты сбрасываются при рестарте.', 'Counts are bot appearances, not unique matches. Highlights require at least five games and do not establish superiority. Session demos and pairs reset on restart.') }}</p></div></div>
        <div class="bot-metrics-wrap">
          <!-- Карточки ключевых показателей: Топ-уровень, Топ-стиль, Лучший дуэт, Слабейший дуэт -->
          <div class="bot-highlights-grid">
            <div class="highlight-card">
              <div class="hl-head">
                <AppIcon name="crown" :size="14" />
                <span class="hl-label">Топ-уровень по очкам</span>
              </div>
              <div v-if="topLevel" class="hl-content">
                <span class="hl-main">Ур.{{ topLevel.level }} · {{ topLevel.name }}</span>
                <span class="hl-sub mono" title="Очки = (победы + 0.5 × ничьи) / игры">{{ topLevel.winRate }}% очков ({{ topLevel.totalGames }} игр) · {{ topLevel.elo }} Elo</span>
              </div>
              <div v-else class="hl-empty dim tiny">Недостаточно данных</div>
            </div>

            <div class="highlight-card">
              <div class="hl-head">
                <AppIcon name="bolt" :size="14" />
                <span class="hl-label">Самый результативный стиль</span>
              </div>
              <div v-if="topPersonality" class="hl-content">
                <span class="hl-main">{{ topPersonality.name }} · {{ topPersonality.badge }}</span>
                <span class="hl-sub mono" title="Очки = (победы + 0.5 × ничьи) / игры">{{ topPersonality.winRate }}% очков ({{ topPersonality.totalGames }} игр)</span>
              </div>
              <div v-else class="hl-empty dim tiny">Недостаточно данных</div>
            </div>

            <div class="highlight-card">
              <div class="hl-head">
                <AppIcon name="plus" :size="14" />
                <span class="hl-label">Лучший дуэт · демо/тюнинг</span>
              </div>
              <div v-if="bestPair" class="hl-content">
                <span class="hl-main">{{ bestPair.bot1Name }} + {{ bestPair.bot2Name }}</span>
                <span class="hl-sub mono" title="Очки = (победы + 0.5 × ничьи) / партии">{{ bestPair.winRate }}% очков ({{ bestPair.totalGames }} партий)</span>
              </div>
              <div v-else class="hl-empty dim tiny">Недостаточно данных у дуэтов</div>
            </div>

            <div class="highlight-card">
              <div class="hl-head">
                <AppIcon name="flag" :size="14" />
                <span class="hl-label">Слабейший дуэт · демо/тюнинг</span>
              </div>
              <div v-if="worstPair && worstPair.pairKey !== bestPair?.pairKey" class="hl-content">
                <span class="hl-main">{{ worstPair.bot1Name }} + {{ worstPair.bot2Name }}</span>
                <span class="hl-sub mono" title="Очки = (победы + 0.5 × ничьи) / партии">{{ worstPair.winRate }}% очков ({{ worstPair.totalGames }} партий)</span>
              </div>
              <div v-else class="hl-empty dim tiny">Пока недостаточно матчей</div>
            </div>
          </div>

          <!-- Панель фильтров и переключателей -->
          <div class="metrics-controls-row">
            <div class="tab-pills view-mode-pills">
              <button
                type="button"
                class="tiny pill"
                :class="{ active: botViewMode === 'levels' }" :aria-pressed="botViewMode === 'levels'"
                @click="botViewMode = 'levels'"
              >
                По уровням силы (12 уровней)
              </button>
              <button
                type="button"
                class="tiny pill"
                :class="{ active: botViewMode === 'personalities' }" :aria-pressed="botViewMode === 'personalities'"
                @click="botViewMode = 'personalities'"
              >
                По стилям (12 персоналий)
              </button>
            </div>

            <div class="tab-pills opponent-pills">
              <button
                type="button"
                class="tiny pill"
                :class="{ active: botTab === 'human' }" :aria-pressed="botTab === 'human'"
                @click="botTab = 'human'"
              >
                {{ txt('С участием людей', 'With human players') }}
              </button>
              <button
                type="button"
                class="tiny pill"
                :class="{ active: botTab === 'bot' }" :aria-pressed="botTab === 'bot'"
                @click="botTab = 'bot'"
                title="Демо и тюнинг-партии ИИ vs ИИ (in-memory, сбрасывается при рестарте сервера)"
              >
                ИИ vs ИИ (Демо/Тюнинг)
              </button>
            </div>
          </div>

          <!-- Таблица 1: По уровням силы (12 уровней) -->
          <div v-if="botViewMode === 'levels'" class="table-wrap">
            <table v-if="displayedLevelMetrics.length" class="club">
              <thead>
                <tr>
                  <SortableHeader :direction="levelSort.sortDirection('level')" @sort="levelSort.sortBy('level')">Уровень</SortableHeader>
                  <SortableHeader :direction="levelSort.sortDirection('elo')" @sort="levelSort.sortBy('elo')">Номинал Elo</SortableHeader>
                  <SortableHeader v-for="[key, label] in metricColumns" :key="key" :title="metricTitles[key]" :direction="levelSort.sortDirection(key)" @sort="levelSort.sortBy(key, 'descending')">{{ label }}</SortableHeader>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="b in levelSort.sortedRows.value"
                  :key="b.level"
                  :class="{ 'highlight-top': topLevel?.level === b.level && b.winRate > 0 }"
                >
                  <td>
                    <strong>Ур.{{ b.level }} · {{ b.name }}</strong>
                    <span v-if="topLevel?.level === b.level && b.winRate > 0" class="top-tag mono">
                      Топ
                    </span>
                  </td>
                  <td class="mono">{{ b.elo }}</td>
                  <td class="mono dim">{{ b.totalGames }}</td>
                  <td class="mono dim">{{ b.wins }} / {{ b.losses }} / {{ b.draws }}</td>
                  <td>
                    <span
                      class="badge mono"
                      :title="`${b.wins} побед, ${b.draws} ничьих, ${b.losses} поражений из ${b.totalGames}`"
                      :class="{
                        ok: b.winRate >= 45 && b.winRate <= 65,
                        win: b.winRate > 65,
                        dim: b.winRate < 45,
                      }"
                    >
                      {{ b.winRate }}%
                    </span>
                  </td>
                  <td class="mono dim" :title="`Мат: ${b.checkmateCount}, флаг: ${b.timeoutCount}, пат: ${b.stalemateCount}`">{{ b.checkmateCount }} / {{ b.timeoutCount }} / {{ b.stalemateCount }}</td>
                  <td class="mono dim">{{ b.avgMoves }}</td>
                </tr>
              </tbody>
            </table>
            <div v-else class="empty dim tiny" style="padding: 24px; text-align: center;">
              {{ botTab === 'bot' ? 'Партий ИИ против ИИ пока не зафиксировано на этом сервере.' : 'Боты пока не играли партий против людей на этом сервере.' }}
            </div>
          </div>

          <!-- Таблица 2: По стилям (12 персоналий) — описание и Elo только в тултипе бейджа -->
          <div v-else class="table-wrap">
            <table v-if="displayedPersonalityMetrics.length" class="club">
              <thead>
                <tr>
                  <SortableHeader :direction="personalitySort.sortDirection('name')" @sort="personalitySort.sortBy('name')">Персоналия</SortableHeader>
                  <SortableHeader v-for="[key, label] in metricColumns" :key="key" :title="metricTitles[key]" :direction="personalitySort.sortDirection(key)" @sort="personalitySort.sortBy(key, 'descending')">{{ label }}</SortableHeader>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="p in personalitySort.sortedRows.value"
                  :key="p.username"
                  :class="{ 'highlight-top': topPersonality?.username === p.username && p.winRate > 0 }"
                >
                  <td>
                    <strong :title="p.username">{{ p.name }}</strong>
                    <span
                      class="bot-badge tiny"
                      style="margin-left: 6px;"
                      :title="`${p.title} — ${p.description} · ${p.bestEloText || `${p.defaultElo} (Номинал)`}`"
                    >
                      {{ p.badge }}
                    </span>
                    <span v-if="topPersonality?.username === p.username && p.winRate > 0" class="top-tag mono">
                      Топ
                    </span>
                  </td>
                  <td class="mono dim">{{ p.totalGames }}</td>
                  <td class="mono dim">{{ p.wins }} / {{ p.losses }} / {{ p.draws }}</td>
                  <td>
                    <span
                      class="badge mono"
                      :title="`${p.wins} побед, ${p.draws} ничьих, ${p.losses} поражений из ${p.totalGames}`"
                      :class="{
                        ok: p.winRate >= 45 && p.winRate <= 65,
                        win: p.winRate > 65,
                        dim: p.winRate < 45,
                      }"
                    >
                      {{ p.winRate }}%
                    </span>
                  </td>
                  <td class="mono dim" :title="`Мат: ${p.checkmateCount}, флаг: ${p.timeoutCount}, пат: ${p.stalemateCount}`">{{ p.checkmateCount }} / {{ p.timeoutCount }} / {{ p.stalemateCount }}</td>
                  <td class="mono dim">{{ p.avgMoves }}</td>
                </tr>
              </tbody>
            </table>
            <div v-else class="empty dim tiny" style="padding: 24px; text-align: center;">
              {{ botTab === 'bot' ? 'Партий ИИ против ИИ пока не зафиксировано на этом сервере.' : 'Боты пока не играли партий против людей на этом сервере.' }}
            </div>
          </div>
        </div>
      </div>


    </section>
  </div>
</template>
<style scoped>
.panel-title {
  font-size: 20px;
  margin: 0;
}
.admin-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.table-wrap {
  overflow-x: auto;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid var(--line);
  background: var(--surface-inset);
}

.metric-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.metric-val {
  font-size: 20px;
  font-weight: 700;
  color: var(--ink);
}

.metric-sub-hint {
  font-size: 11px;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bot-metrics-panel {
  border-bottom: 1px solid var(--line);
}

.bot-metrics-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  user-select: none;
  transition: background 0.15s ease;
}

.bot-metrics-head.clickable {
  cursor: pointer;
}

.bot-metrics-head.clickable:hover {
  background: var(--surface-2);
}

.bot-head-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.top-stat-pill {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: var(--r-xs);
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: var(--accent);
  border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
}

.bot-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.bot-highlights-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}

.highlight-card {
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: var(--r-s);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.hl-head {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--accent);
}

.hl-label {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--ink-2);
}

.hl-main {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--ink);
  line-height: 1.3;
}

.hl-sub {
  font-size: 11px;
  color: var(--ink-2);
}

.hl-empty {
  font-size: 11px;
  color: var(--ink-3);
  margin-top: 2px;
}

.top-tag {
  font-size: 9.5px;
  font-weight: 700;
  text-transform: uppercase;
  padding: 1px 5px;
  border-radius: var(--r-xs);
  background: var(--accent);
  color: #000000;
  margin-left: 6px;
}

.bot-badge.tiny[title] {
  cursor: help;
  white-space: nowrap;
}

.highlight-top {
  background: color-mix(in srgb, var(--accent) 6%, transparent);
}

.metrics-controls-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: 10px;
}

.bot-metrics-wrap {
  border-top: 1px solid var(--line);
  padding: 16px;
  background: var(--surface);
}

.section-title {
  margin: 0;
  font-size: 16px;
}

.metrics-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: 10px;
}

.tab-pills {
  display: flex;
  gap: 6px;
}

.user-head {
  padding-top: 16px;
}

.is-me {
  background: color-mix(in srgb, var(--accent-2) 6%, transparent);
}

.admin-actions {
  display: inline-flex;
  gap: 6px;
  justify-content: flex-end;
}
</style>

<style scoped>
.admin-page { width: min(100%, 1240px); margin-inline: auto; gap: 18px; min-width: 0; }
.admin-header, .section-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.admin-header h1 { margin: 3px 0 8px; font-size: clamp(24px, 3vw, 32px); }
.admin-header p, .section-heading p { margin: 4px 0 0; }
.eyebrow { font: 11px var(--font-mono); color: var(--ink-3); letter-spacing: .12em; }
.admin-nav { display: flex; gap: 4px; padding: 5px; background: var(--surface-inset); border: 1px solid var(--line); border-radius: var(--r-m); }
.admin-nav button { flex: 1; border: 1px solid transparent; background: transparent; min-height: 44px; }
.admin-nav button.active { background: var(--surface); border-color: var(--line); color: var(--accent); box-shadow: 0 2px 6px #00000008; }
.admin-section { min-width: 0; display: flex; flex-direction: column; gap: 16px; }
.section-heading h2, .section-heading h3 { margin: 0; }
.section-heading h2 { font-size: 20px; }
.overview-heading { flex-wrap: wrap; gap: 12px; }
.period-picker { display: flex; flex-wrap: wrap; gap: 4px; padding: 3px; border: 1px solid var(--line); border-radius: var(--r-s); background: var(--surface-inset); }
.period-picker button.active { background: var(--surface); color: var(--accent); border-color: var(--line-2); }
.activity-panel { display: grid; gap: 14px; padding: 20px; }
.activity-main { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.activity-main > div { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
.activity-main .metric-val { font-size: clamp(22px, 5vw, 38px); }
.activity-bar { display: flex; overflow: hidden; height: 8px; border-radius: 99px; }
.activity-bar > div { flex-basis: 0; }
.activity-panel .finished { --signal: #608c68; }
.activity-panel .abandoned { --signal: #c18665; }
.activity-panel .active { --signal: var(--accent); }
.activity-bar > div, .activity-legend i { background: var(--signal); }
.activity-legend { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 16px; font-size: 13px; }
.activity-legend > * { display: inline-flex; gap: 6px; align-items: center; }
.activity-legend button { padding-inline: 6px; }
.activity-legend i { border-radius: 50%; width: 9px; height: 9px; }
.interrupted-split { margin: 0; }
.user-result-count { display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 0; }
.user-result-count strong { color: var(--ink); }
.account-role { white-space: nowrap; }
.account-role-guest { background: var(--surface-inset); color: var(--ink-2); }
.platform-totals { display: flex; flex-wrap: wrap; gap: 6px 18px; }
.diagnosis-title { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px; }
.diagnosis-title h3 { margin: 0; font-size: 16px; }
.diagnosis-warnings { padding-inline-start: 20px; margin-block: 8px 0; }
.overview-details { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.insight-card { padding: 20px; }
.insight-card h3 { margin: 0 0 16px; font-size: 16px; }
.fact-list { margin: 12px 0 0; display: grid; gap: 8px; }
.fact-list > div { display: flex; justify-content: space-between; gap: 20px; border-bottom: 1px solid var(--line); padding: 6px 0; font-size: 13px; }
.fact-list dt { color: var(--ink-2); }
.fact-list dd { margin: 0; text-align: right; overflow-wrap: anywhere; }
.quick-link { width: 100%; display: grid; grid-template-columns: 1fr auto; text-align: left; gap: 5px 14px; padding: 14px 0; background: transparent; border: 0; border-bottom: 1px solid var(--line); border-radius: 0; }
.quick-link .hint { grid-column: 1; }
.quick-link svg { grid-column: 2; grid-row: 1 / 3; align-self: center; }
.admin-filters { display: flex; align-items: end; flex-wrap: wrap; gap: 12px; padding: 16px; border: 1px solid var(--line); border-radius: var(--r-m); background: var(--surface); }
.admin-filters label { display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: var(--ink-2); min-width: 120px; }
.admin-filters .search-field { flex: 1 1 220px; }
.admin-filters input, .admin-filters button { min-height: 40px; }
.admin-filters .admin-select { flex: 0 1 148px; }
.admin-filters .admin-select--wide { flex-basis: 188px; }
.admin-filters input { width: 100%; min-width: 0; }
.admin-pagination { display: flex; align-items: center; gap: 8px; }
.admin-pagination > span { margin-right: auto; }
.admin-pagination button { min-height: 38px; }
.admin-empty { padding: 40px 20px; text-align: center; background: var(--surface-inset); border-radius: var(--r-m); }
.match-list { display: grid; gap: 10px; }
.admin-match { padding: 16px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-m); }
.selected { border-color: var(--accent); background: var(--accent-soft); }
.match-summary, .match-people, .match-footer, .detail-links { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; }
.match-summary > strong { font-size: 17px; }
.match-summary > .badge { margin-left: auto; }
.match-people { padding: 12px 0; font-size: 13px; }
.match-people > span { overflow-wrap: anywhere; }
.match-footer { border-top: 1px solid var(--line); padding-top: 10px; }
.match-footer > .hint { margin-right: auto; }
.match-footer a { padding: 7px; }
.warning-text { color: var(--warn); font-size: 12px; }
.diagnostics { padding: 12px; margin-top: 12px; border-radius: var(--r-s); background: var(--surface-inset); }
.user-table { border: 1px solid var(--line); border-radius: var(--r-m); background: var(--surface); }
.user-table table { min-width: 850px; }
.mobile-users { display: none; }
.user-table td { vertical-align: middle; }
.account-detail { padding: 20px; }
.detail-links { margin-top: 12px; font-size: 13px; }
.rating-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin: 16px 0; }
.rating-cards > div { display: flex; flex-direction: column; gap: 5px; padding: 12px; background: var(--surface-inset); border-radius: var(--r-s); font-size: 13px; }
.danger-reveal { margin-top: 10px; color: var(--bad); }
.danger-zone { margin-top: 12px; padding: 16px; border: 1px solid var(--bad); border-radius: var(--r-m); }
.danger-zone h4 { margin: 0; }
.danger-zone p { font-size: 13px; color: var(--ink-2); line-height: 1.5; }
.danger-zone .admin-actions { justify-content: flex-start; flex-wrap: wrap; }
.bot-metrics-panel { border: 0; }
.bot-metrics-wrap { padding: 16px; margin-top: 16px; border: 1px solid var(--line); border-radius: var(--r-m); }
.bot-metrics-wrap .table-wrap { border-radius: var(--r-s); }
.tab-pills { flex-wrap: wrap; }
@media (max-width: 700px) {
  .user-table { display: none; }
  .mobile-users { display: grid; gap: 10px; }
  .mobile-user { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; padding: 14px; border: 1px solid var(--line); border-radius: var(--r-m); background: var(--surface); }
  .mobile-user > div { min-width: 0; display: flex; flex-direction: column; gap: 4px; overflow-wrap: anywhere; }
  .mobile-user > p { grid-column: 1 / -1; margin: 0; }
  .mobile-user > button { grid-column: 1 / -1; min-height: 40px; }
  .admin-header { align-items: flex-start; }
  .admin-header > button { flex: none; }
  .admin-nav { display: grid; grid-template-columns: 1fr 1fr; }
  .activity-panel { padding: 12px; }
  .activity-main { gap: 8px; }
  .activity-main .hint { font-size: 11px; }
  .overview-details { grid-template-columns: 1fr; }
  .admin-filters { padding: 12px; gap: 10px; }
  .admin-filters label, .admin-filters .admin-select { flex: 1 1 120px; }
  .admin-filters .admin-select--wide { flex-basis: 148px; }
  .admin-filters .search-field { flex-basis: 100%; }
  .admin-pagination { flex-wrap: wrap; }
  .admin-pagination > span { flex-basis: 100%; }
  .admin-pagination button { flex: 1; }
  .section-heading { align-items: flex-start; }
  .account-detail, .insight-card { padding: 14px; }
  .bot-highlights-grid { grid-template-columns: 1fr; }
  .bot-metrics-wrap { padding: 12px; }
  .match-summary > .badge { margin-left: 0; }
  .danger-zone .admin-actions { display: grid; width: 100%; }
}
</style>
