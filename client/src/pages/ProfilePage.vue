<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { ProfilePayload } from 'shared';
import { api } from '../api/rest';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { isMuted, toggleSound } from '../audio/sounds';
import GameReplayModal from '../components/GameReplayModal.vue';

const route = useRoute();
const auth = useAuthStore();
const profile = ref<ProfilePayload | null>(null);
const error = ref('');
const replayId = ref<number | null>(null);

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
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function modeLabel(m: string): string {
  return m === 'bughouse' ? 'Багхаус' : '2×2';
}

function gameOutcome(g: import('shared').GameSummary): string {
  if (g.status === 'abandoned' || g.result === '*') return 'брошена';
  const winner = g.result === '1-0' ? 1 : 2;
  const winners = g.participants.filter((p) => p.team === winner).map((p) => p.username);
  return `победа: ${winners.join(' и ')}`;
}
</script>

<template>
  <div v-if="error" class="empty">{{ error }}</div>
  <div v-else-if="profile" class="profile">
    <div class="profile-head panel">
      <div class="who">
        <h1>{{ profile.user.username }}</h1>
        <p class="dim">в клубе с {{ fmtDate(profile.user.createdAt) }}</p>
      </div>
      <div class="stats">
        <div class="stat">
          <span class="stat-num mono">{{ profile.user.rating }}</span>
          <span class="stat-label">рейтинг</span>
        </div>
        <div class="stat">
          <span class="stat-num mono">{{ profile.user.wins }}</span>
          <span class="stat-label">побед</span>
        </div>
        <div class="stat">
          <span class="stat-num mono">{{ profile.user.losses }}</span>
          <span class="stat-label">поражений</span>
        </div>
      </div>
    </div>

    <div class="panel" v-if="profile.ratingHistory.length >= 2">
      <div class="panel-head"><h2>Динамика рейтинга</h2></div>
      <div class="panel-body">
        <svg viewBox="0 0 560 120" class="spark" preserveAspectRatio="none">
          <path :d="sparkPath!" fill="none" stroke="var(--accent)" stroke-width="2" />
        </svg>
      </div>
    </div>

    <div class="panel" v-if="isMyProfile">
      <div class="panel-head"><h2>Настройки</h2></div>
      <div class="panel-body settings-row">
        <div class="setting-info">
          <span class="setting-title">Звуковые эффекты</span>
          <span class="setting-desc dim">Звуки ходов, взятий, шахов и окончания партии</span>
        </div>
        <button
          class="button"
          :class="isMuted ? 'ghost' : 'primary'"
          @click="toggleSound"
        >
          {{ isMuted ? 'Звук: Выкл' : 'Звук: Вкл' }}
        </button>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><h2>Недавние партии</h2></div>
      <table class="club" v-if="profile.recentGames.length">
        <thead>
          <tr><th>Дата</th><th>Режим</th><th>Участники</th><th>Итог</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="g in profile.recentGames" :key="g.id">
            <td class="mono dim">{{ fmtDate(g.startedAt) }}</td>
            <td>{{ modeLabel(g.mode) }}</td>
            <td>{{ g.participants.map((p) => p.username).join(', ') }}</td>
            <td>{{ gameOutcome(g) }}</td>
            <td class="actions">
              <button v-if="g.status !== 'active'" class="button small ghost" @click="replayId = g.id">Просмотр</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty">Партий пока нет.</div>
    </div>

    <!-- Модальный плеер партии -->
    <GameReplayModal
      v-if="replayId !== null"
      :game-id="replayId"
      :title="`Партия #${replayId}`"
      @close="replayId = null"
    />
  </div>
  <div v-else class="empty">Загрузка…</div>
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
