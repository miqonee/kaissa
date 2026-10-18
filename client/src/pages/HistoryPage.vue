<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import type { GameSummary } from 'shared';
import { timeControlLabel } from 'shared';
import { api } from '../api/rest';
import { useAuthStore } from '../stores/auth';
import { useI18n } from '../stores/i18n';
import GameReplayModal from '../components/GameReplayModal.vue';
import AppIcon from '../components/AppIcon.vue';
import { openLichessAnalysis } from '../api/lichess';
import { usePageSeo } from '../composables/useSeo';

const auth = useAuthStore();
const router = useRouter();
const i18n = useI18n();

usePageSeo({
  title: computed(() => (i18n.locale === 'en' ? `Match Archive: 2v2 and Bughouse Replays | ${i18n.t.nav.brand}` : 'Архив партий: реплеи командных шахмат 2 на 2 и Багхауса | Каисса')),
  description: computed(() => (i18n.locale === 'en' ? 'Archive of played matches on Kaissa platform. Interactive move replay, PGN export, and game analysis.' : 'Архив сыгранных матчей на платформе Каисса. Интерактивный просмотр реплеев игр 2х2 и шведских шахмат, история ходов и анализ партий.')),
  keywords: [
    'архив партий',
    'база партий',
    'история шахматных игр',
    'реплеи шахмат',
    'pgn шахматы',
    'kaissa archive',
  ],
  canonical: '/history',
});

const tab = ref<'mine' | 'all'>('mine');
const games = ref<GameSummary[]>([]);
const loading = ref(true);
const lichessLoading = ref<number | null>(null);
const replayId = ref<number | null>(null);

async function loadGames() {
  loading.value = true;
  try {
    if (tab.value === 'mine') {
      const res = await api.get<{ games: GameSummary[] }>('/api/games/mine');
      games.value = res.games;
    } else {
      const res = await api.get<{ games: GameSummary[] }>('/api/games/archive?limit=100');
      games.value = res.games;
    }
  } catch (e) {
    games.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(loadGames);
watch(tab, loadGames);

function modeLabel(m: string): string {
  return m === 'bughouse' ? i18n.t.home.modeBughouse : i18n.t.home.modeTeam;
}

function meOf(g: GameSummary) {
  return g.participants.find((p) => p.userId === auth.user?.id);
}

function outcome(g: GameSummary): { text: string; cls: string } {
  const isEn = i18n.locale === 'en';
  if (g.status === 'active') return { text: isEn ? 'Live' : 'Идёт', cls: 'live' };
  if (g.status === 'abandoned') return { text: isEn ? 'Abandoned' : 'Брошена', cls: 'dim' };
  if (g.result === '*' || g.result === '1/2-1/2') return { text: isEn ? 'Draw' : 'Ничья', cls: 'dim' };
  if (tab.value === 'all') {
    return { text: g.result === '1-0' ? (isEn ? 'White won' : 'Победа белых') : (isEn ? 'Black won' : 'Победа чёрных'), cls: '' };
  }
  const me = meOf(g);
  if (!me) return { text: g.result, cls: '' };
  const myTeamWon = (g.result === '1-0' && me.team === 1) || (g.result === '0-1' && me.team === 2);
  return myTeamWon ? { text: isEn ? 'Win' : 'Победа', cls: 'win' } : { text: isEn ? 'Loss' : 'Поражение', cls: 'loss' };
}

function formatTeams(g: GameSummary): { t1: string; t2: string } {
  const t1 = g.participants.filter((p) => p.team === 1).map((p) => p.username).join(' / ');
  const t2 = g.participants.filter((p) => p.team === 2).map((p) => p.username).join(' / ');
  return { t1: t1 || '—', t2: t2 || '—' };
}

function delta(g: GameSummary): number {
  const me = meOf(g);
  if (!me || me.ratingAfter === null) return 0;
  return me.ratingAfter - me.ratingBefore;
}

function deltaText(g: GameSummary): string {
  const d = delta(g);
  if (g.status === 'abandoned' || g.status === 'active') return '—';
  if (d === 0) return '0';
  return (d > 0 ? '+' : '') + d;
}

function deltaClass(g: GameSummary): string {
  const d = delta(g);
  return d > 0 ? 'win' : d < 0 ? 'loss' : 'dim';
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function openReplay(g: GameSummary): void {
  if (g.status === 'active') {
    router.push(`/game/${g.id}`);
  } else {
    replayId.value = g.id;
  }
}

function onRowKey(e: KeyboardEvent, g: GameSummary): void {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    openReplay(g);
  }
}

async function analyzeOnLichess(gameId: number) {
  lichessLoading.value = gameId;
  try {
    await openLichessAnalysis(gameId, 0);
  } finally {
    lichessLoading.value = null;
  }
}
</script>

<template>
  <div class="history-page">
    <section class="panel history-panel" aria-label="Архив партий">
      <div class="panel-head">
        <div class="head-tabs" role="tablist" aria-label="Фильтр партий">
          <button
            class="tab-btn"
            :class="{ active: tab === 'mine' }"
            role="tab"
            :aria-selected="tab === 'mine'"
            @click="tab = 'mine'"
          >
            {{ i18n.locale === 'en' ? 'My Matches' : 'Мои партии' }}
          </button>
          <button
            class="tab-btn"
            :class="{ active: tab === 'all' }"
            role="tab"
            :aria-selected="tab === 'all'"
            @click="tab = 'all'"
          >
            {{ i18n.locale === 'en' ? 'All Matches' : 'Все партии' }}
          </button>
        </div>
        <span class="hint">{{ games.length }} {{ i18n.locale === 'en' ? 'matches' : 'записей' }}</span>
      </div>

      <div v-if="loading" class="empty">{{ i18n.locale === 'en' ? 'Loading matches…' : 'Загрузка партий…' }}</div>

      <div v-else-if="!games.length" class="empty">
        <p class="empty-title">{{ i18n.t.history.emptyText }}</p>
        <router-link to="/" class="button primary small">{{ i18n.locale === 'en' ? 'Go to tables' : 'Перейти к столам' }}</router-link>
      </div>

      <div v-else class="table-wrap">
        <table class="club">
          <thead>
            <tr>
              <th>{{ i18n.t.history.colDate }}</th>
              <th>{{ i18n.t.history.colMode }}</th>
              <th>{{ i18n.locale === 'en' ? 'Clock' : 'Контроль' }}</th>
              <th>{{ i18n.locale === 'en' ? 'Team 1 (White)' : 'Команда 1 (белые)' }}</th>
              <th>{{ i18n.locale === 'en' ? 'Team 2 (Black)' : 'Команда 2 (черные)' }}</th>
              <th>{{ i18n.t.history.colResult }}</th>
              <th v-if="tab === 'mine'" class="num">{{ i18n.t.history.colRatingChange }}</th>
              <th class="actions">{{ i18n.locale === 'en' ? 'Actions' : 'Действия' }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="g in games"
              :key="g.id"
              class="row-link"
              role="button"
              tabindex="0"
              :title="g.status === 'active' ? (i18n.locale === 'en' ? 'Live match — watch online' : 'Партия идёт — смотреть онлайн') : (i18n.locale === 'en' ? 'Open game replayer' : 'Открыть плеер партии')"
              @click="openReplay(g)"
              @keydown="onRowKey($event, g)"
            >
              <td class="mono dim">{{ fmtDate(g.startedAt) }}</td>
              <td>
                <span class="badge">{{ modeLabel(g.mode) }}</span>
              </td>
              <td class="mono dim">{{ timeControlLabel(g.timeControl) }}</td>
              <td class="nowrap">{{ formatTeams(g).t1 }}</td>
              <td class="nowrap">{{ formatTeams(g).t2 }}</td>
              <td :class="outcome(g).cls" style="font-weight: 600;">
                {{ outcome(g).text }}
              </td>
              <td v-if="tab === 'mine'" class="mono num" :class="deltaClass(g)" style="font-weight: 700;">
                {{ deltaText(g) }}
              </td>
              <td class="actions">
                <div class="actions-cell">
                  <button
                    class="button small ghost"
                    :title="g.status === 'active' ? (i18n.locale === 'en' ? 'Watch live' : 'Смотреть онлайн') : (i18n.locale === 'en' ? 'Open replayer' : 'Открыть плеер')"
                    @click.stop="openReplay(g)"
                  >
                    <AppIcon :name="g.status === 'active' ? 'eye' : 'play'" :size="14" />
                    {{ g.status === 'active' ? 'Онлайн' : 'Плеер' }}
                  </button>

                  <a
                    v-if="g.status !== 'active'"
                    :href="`/api/games/${g.id}/pgn?download=1`"
                    class="button small ghost"
                    title="Скачать PGN файл"
                    download
                    @click.stop
                  >
                    <AppIcon name="download" :size="14" />
                    PGN
                  </a>

                  <button
                    v-if="g.status !== 'active' && g.mode === 'team'"
                    class="button small brass"
                    :disabled="lichessLoading === g.id"
                    @click.stop="analyzeOnLichess(g.id)"
                    title="Импортировать и разобрать партию на Lichess"
                  >
                    <AppIcon name="external" :size="13" />
                    {{ lichessLoading === g.id ? '…' : 'Lichess' }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <GameReplayModal
      v-if="replayId !== null"
      :game-id="replayId"
      @close="replayId = null"
    />
  </div>
</template>

<style scoped>
.history-page {
  display: flex;
  flex-direction: column;
  gap: var(--gap-l);
}

.head-tabs {
  display: flex;
  gap: var(--gap-xs);
  flex-wrap: wrap;
}

.tab-btn {
  background: transparent;
  border: 1px solid transparent;
  color: var(--ink-3);
  padding: 6px 14px;
  border-radius: var(--r-s);
  font-size: 14px;
  font-weight: 600;
}
.tab-btn:hover {
  color: var(--ink);
  background: var(--surface-inset);
  border-color: transparent;
}
.tab-btn.active {
  background: var(--accent-soft);
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
  color: var(--accent);
}

.table-wrap {
  overflow-x: auto;
}

.actions-cell {
  display: inline-flex;
  gap: 6px;
  justify-content: flex-end;
}

td.live {
  color: var(--ok);
}
</style>
