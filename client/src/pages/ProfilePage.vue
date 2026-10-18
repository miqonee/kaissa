<script setup lang="ts">
import { modeLabel as sharedModeLabel, type GameMode } from 'shared';
import { computed, onMounted, ref } from 'vue';
import type { ProfilePayload } from 'shared';
import { api } from '../api/rest';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useI18n } from '../stores/i18n';
import { isMuted, toggleSound } from '../audio/sounds';
import GameReplayModal from '../components/GameReplayModal.vue';
import { usePageSeo } from '../composables/useSeo';

const route = useRoute();
const auth = useAuthStore();
const i18n = useI18n();
const profile = ref<ProfilePayload | null>(null);
const error = ref('');
const replayId = ref<number | null>(null);

const username = computed(() => (route.params.username as string) || '');
const pageTitle = computed(() => (i18n.locale === 'en' ? `Player Profile: ${username.value} | ${i18n.t.nav.brand}` : `Профиль игрока ${username.value}: рейтинг и статистика | Каисса`));
const pageDescription = computed(() => {
  if (profile.value?.user) {
    const u = profile.value.user;
    const total = u.wins + u.losses + (u.draws || 0);
    return i18n.locale === 'en'
      ? `Player profile ${u.username} on Kaissa: ${u.rating} Elo, wins: ${u.wins}, losses: ${u.losses}, games played: ${total}.`
      : `Профиль игрока ${u.username} в Каиссе: рейтинг ${u.rating} Elo, побед: ${u.wins}, поражений: ${u.losses}, сыграно партий: ${total}. Статистика и история матчей.`;
  }
  return i18n.locale === 'en'
    ? `Player profile ${username.value}: rating, game statistics and match history on Kaissa.`
    : `Профиль игрока ${username.value}: рейтинг, статистика партий и история матчей в Каиссе.`;
});

usePageSeo({
  title: pageTitle,
  description: pageDescription,
  canonical: computed(() => `/players/${username.value}`),
});

const isMyProfile = computed(() => auth.user?.username === profile.value?.user.username);

onMounted(async () => {
  try {
    profile.value = await api.get<ProfilePayload>(`/api/users/${route.params.username}`);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Ошибка';
  }
});

/** Простая SVG-спарклайна рейтинга без библиотек */
const sparkPath = computed(() => {
  if (!profile.value || profile.value.ratingHistory.length < 2) return null;
  const pts = profile.value.ratingHistory;
  const w = 560;
  const h = 120;
  const minR = Math.min(...pts.map((p) => p.rating));
  const maxR = Math.max(...pts.map((p) => p.rating));
  const span = Math.max(1, maxR - minR);
  const step = w / (pts.length - 1);
  return pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(h - ((p.rating - minR) / span) * (h - 10) - 5).toFixed(1)}`)
    .join(' ');
});

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(i18n.locale === 'en' ? 'en-US' : 'ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function modeLabel(m: GameMode): string { return sharedModeLabel(m, i18n.locale); }

function gameOutcome(g: import('shared').GameSummary): string {
  const isEn = i18n.locale === 'en';
  if (g.status === 'abandoned' || g.result === '*') return isEn ? 'abandoned' : 'брошена';
  const winner = g.result === '1-0' ? 1 : 2;
  const winners = g.participants.filter((p) => p.team === winner).map((p) => p.username);
  return isEn ? `victory: ${winners.join(' & ')}` : `победа: ${winners.join(' и ')}`;
}
</script>

<template>
  <div v-if="error" class="empty">{{ error }}</div>
  <div v-else-if="profile" class="profile">
    <header class="profile-head panel">
      <div class="who">
        <h1>{{ profile.user.username }}</h1>
        <p class="dim">{{ i18n.locale === 'en' ? 'since' : 'с' }} {{ fmtDate(profile.user.createdAt) }}</p>
      </div>
      <div class="stats">
        <div class="stat">
          <span class="stat-num mono">{{ profile.user.rating }}</span>
          <span class="stat-label">{{ i18n.t.profile.ratingElo }}</span>
        </div>
        <div class="stat">
          <span class="stat-num mono">{{ profile.user.wins }}</span>
          <span class="stat-label">{{ i18n.t.profile.statWins }}</span>
        </div>
        <div class="stat">
          <span class="stat-num mono">{{ profile.user.losses }}</span>
          <span class="stat-label">{{ i18n.t.profile.statLosses }}</span>
        </div>
      </div>
    </header>

    <section class="panel" aria-labelledby="rating-dyn-heading" v-if="profile.ratingHistory.length >= 2">
      <div class="panel-head"><h2 id="rating-dyn-heading">{{ i18n.t.profile.chartTitle }}</h2></div>
      <div class="panel-body">
        <svg viewBox="0 0 560 120" class="spark" preserveAspectRatio="none" role="img" aria-label="Rating Chart">
          <title>Rating Chart</title>
          <path :d="sparkPath!" fill="none" stroke="var(--accent)" stroke-width="2" />
        </svg>
      </div>
    </section>

    <section class="panel" aria-labelledby="settings-heading" v-if="isMyProfile">
      <div class="panel-head"><h2 id="settings-heading">{{ i18n.locale === 'en' ? 'Settings' : 'Настройки' }}</h2></div>
      <div class="panel-body settings-row">
        <div class="setting-info">
          <span class="setting-title">{{ i18n.locale === 'en' ? 'Sound Effects' : 'Звуковые эффекты' }}</span>
          <span class="setting-desc dim">{{ i18n.locale === 'en' ? 'Move sounds, captures, checks, and game end' : 'Звуки ходов, взятий, шахов и окончания партии' }}</span>
        </div>
        <button
          class="button"
          :class="isMuted ? 'ghost' : 'primary'"
          @click="toggleSound"
        >
          {{ isMuted ? (i18n.locale === 'en' ? 'Sound: Muted' : 'Звук: Выкл') : (i18n.locale === 'en' ? 'Sound: On' : 'Звук: Вкл') }}
        </button>
      </div>
    </section>

    <section class="panel" aria-labelledby="recent-games-heading">
      <div class="panel-head"><h2 id="recent-games-heading">{{ i18n.t.profile.recentMatches }}</h2></div>
      <div v-if="profile.recentGames.length" class="table-wrap">
        <table class="club">
          <thead>
            <tr>
              <th>{{ i18n.t.history.colDate }}</th>
              <th>{{ i18n.t.history.colMode }}</th>
              <th>{{ i18n.t.history.colPlayers }}</th>
              <th>{{ i18n.t.history.colResult }}</th>
              <th>{{ i18n.locale === 'en' ? 'Actions' : 'Действия' }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="g in profile.recentGames" :key="g.id">
              <td class="mono dim">{{ fmtDate(g.startedAt) }}</td>
              <td>{{ modeLabel(g.mode) }}</td>
              <td>{{ g.participants.map((p) => p.username).join(', ') }}</td>
              <td>{{ gameOutcome(g) }}</td>
              <td class="actions">
                <button v-if="g.status !== 'active'" class="button small ghost" @click="replayId = g.id">{{ i18n.t.history.actionReplay }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="empty">{{ i18n.t.profile.noGamesYet }}</div>
    </section>

    <!-- Модальный плеер партии -->
    <GameReplayModal
      v-if="replayId !== null"
      :game-id="replayId"
      :title="i18n.locale === 'en' ? `Match #${replayId}` : `Партия #${replayId}`"
      @close="replayId = null"
    />
  </div>
  <div v-else class="empty">{{ i18n.locale === 'en' ? 'Loading…' : 'Загрузка…' }}</div>
</template>

<style scoped>
.profile-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  padding: 20px 24px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.who p { margin: 4px 0 0; }

.stats { display: flex; gap: 36px; }

.stat { display: flex; flex-direction: column; align-items: center; }

.stat-num { font-size: 28px; font-weight: 600; }

.stat-label { font-size: 13px; color: var(--ink-3); }

.spark { width: 100%; height: 120px; }

.settings-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  gap: 16px;
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.setting-title {
  font-weight: 600;
  font-size: 15px;
}

.setting-desc {
  font-size: 13px;
}
</style>
