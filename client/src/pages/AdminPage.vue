<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { AdminUserRow, PlatformMetrics } from 'shared';
import { api } from '../api/rest';
import { useAuthStore } from '../stores/auth';
import AppIcon from '../components/AppIcon.vue';

const auth = useAuthStore();
const users = ref<AdminUserRow[]>([]);
const metrics = ref<PlatformMetrics | null>(null);
const loading = ref(true);
const error = ref('');
const busyId = ref<number | null>(null);
const isBotMetricsOpen = ref(false);
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

const topLevel = computed(() => {
  if (metrics.value?.topLevel) return metrics.value.topLevel;
  const list = currentLevelMetrics.value.filter((l) => l.totalGames >= 1);
  if (!list.length) return null;
  return list.slice().sort((a, b) => b.winRate - a.winRate || b.totalGames - a.totalGames)[0];
});

const topPersonality = computed(() => {
  if (metrics.value?.topPersonality) return metrics.value.topPersonality;
  const list = currentPersonalityMetrics.value.filter((p) => p.totalGames >= 1);
  if (!list.length) return null;
  return list.slice().sort((a, b) => b.winRate - a.winRate || b.totalGames - a.totalGames)[0];
});

const bestPair = computed(() => metrics.value?.bestPair || null);
const worstPair = computed(() => metrics.value?.worstPair || null);

async function loadData() {
  loading.value = true;
  error.value = '';
  try {
    const [uRes, mRes] = await Promise.all([
      api.get<{ users: AdminUserRow[] }>('/api/admin/users'),
      api.get<PlatformMetrics>('/api/admin/metrics'),
    ]);
    users.value = uRes.users;
    metrics.value = mRes;
  } catch (e: any) {
    error.value = e.message || 'Ошибка загрузки данных';
  } finally {
    loading.value = false;
  }
}

onMounted(loadData);

async function deleteUser(u: AdminUserRow) {
  if (!confirm(`Вы действительно хотите удалить аккаунт «${u.username}» и ВСЕ его партии?`)) {
    return;
  }
  busyId.value = u.id;
  try {
    await api.delete(`/api/admin/users/${u.id}`);
    await loadData();
  } catch (e: any) {
    alert(e.message || 'Ошибка удаления');
  } finally {
    busyId.value = null;
  }
}

async function resetRating(u: AdminUserRow) {
  if (!confirm(`Сбросить рейтинг и победы игрока «${u.username}» на 1200?`)) return;
  busyId.value = u.id;
  try {
    await api.post(`/api/admin/users/${u.id}/reset`, {});
    await loadData();
  } catch (e: any) {
    alert(e.message || 'Ошибка сброса');
  } finally {
    busyId.value = null;
  }
}

async function toggleAdmin(u: AdminUserRow) {
  busyId.value = u.id;
  try {
    await api.post(`/api/admin/users/${u.id}/admin`, { isAdmin: !u.isAdmin });
    await loadData();
  } catch (e: any) {
    alert(e.message || 'Ошибка смены прав');
  } finally {
    busyId.value = null;
  }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function fmtDuration(sec: number): string {
  if (!sec) return '0с';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  if (!m) return `${s}с`;
  return `${m}м ${s}с`;
}
</script>

<template>
  <div class="admin-page">
    <div class="panel">
      <div class="panel-head">
        <div>
          <h2>Панель администратора</h2>
          <span class="hint">Метрики платформы, балансировка ботов и управление игроками</span>
        </div>
        <button class="small ghost" @click="loadData">
          <AppIcon name="refresh" :size="14" /> Обновить
        </button>
      </div>

      <!-- Общие метрики платформы -->
      <div v-if="metrics" class="metrics-grid">
        <div class="metric-card">
          <span class="dim tiny">Онлайн</span>
          <span class="metric-val mono">{{ metrics.onlineUsers }}</span>
        </div>
        <div class="metric-card">
          <span class="dim tiny">Пользователей</span>
          <span class="metric-val mono">{{ metrics.totalUsers }}</span>
        </div>
        <div class="metric-card">
          <span class="dim tiny">Всего партий</span>
          <span class="metric-val mono">{{ metrics.totalGames }}</span>
        </div>
        <div class="metric-card">
          <span class="dim tiny">Всего ходов</span>
          <span class="metric-val mono">{{ metrics.totalMoves }}</span>
        </div>
        <div class="metric-card">
          <span class="dim tiny">Ср. длительность</span>
          <span class="metric-val mono">{{ fmtDuration(metrics.avgGameDurationSec) }}</span>
        </div>
      </div>

      <!-- Сворачиваемый блок калибровки и статистики ботов (по умолчанию свернут) -->
      <div v-if="metrics" class="bot-metrics-panel">
        <div class="panel-head bot-metrics-head clickable" @click="isBotMetricsOpen = !isBotMetricsOpen">
          <div class="bot-head-left">
            <h3>Калибровка и статистика ботов</h3>
            <span class="hint">12 уровней Stockfish · 12 стилей гроссмейстеров</span>
            <span v-if="topLevel && !isBotMetricsOpen" class="top-stat-pill mono">
              Топ: Ур.{{ topLevel.level }} ({{ topLevel.winRate }}% побед)
            </span>
          </div>
          <button class="small ghost bot-toggle-btn" type="button" aria-label="Свернуть / развернуть блок">
            <span>{{ isBotMetricsOpen ? 'Свернуть' : 'Развернуть' }}</span>
            <AppIcon :name="isBotMetricsOpen ? 'chevron-up' : 'chevron-down'" :size="15" />
          </button>
        </div>

        <div v-show="isBotMetricsOpen" class="panel-body bot-metrics-wrap">
          <!-- Карточки ключевых показателей: Топ-уровень, Топ-стиль, Лучший дуэт, Слабейший дуэт -->
          <div class="bot-highlights-grid">
            <div class="highlight-card">
              <div class="hl-head">
                <AppIcon name="crown" :size="14" />
                <span class="hl-label">Топ-уровень побед</span>
              </div>
              <div v-if="topLevel" class="hl-content">
                <span class="hl-main">Ур.{{ topLevel.level }} {{ topLevel.name }}</span>
                <span class="hl-sub mono">{{ topLevel.winRate }}% побед ({{ topLevel.totalGames }} игр) · {{ topLevel.elo }} Elo</span>
              </div>
              <div v-else class="hl-empty dim tiny">Нет завершенных игр</div>
            </div>

            <div class="highlight-card">
              <div class="hl-head">
                <AppIcon name="bolt" :size="14" />
                <span class="hl-label">Самый результативный стиль</span>
              </div>
              <div v-if="topPersonality" class="hl-content">
                <span class="hl-main">{{ topPersonality.name }} · {{ topPersonality.badge }}</span>
                <span class="hl-sub mono">{{ topPersonality.winRate }}% побед ({{ topPersonality.totalGames }} игр)</span>
              </div>
              <div v-else class="hl-empty dim tiny">Нет завершенных игр</div>
            </div>

            <div class="highlight-card">
              <div class="hl-head">
                <AppIcon name="plus" :size="14" />
                <span class="hl-label">Лучшая синергия (дуэт 2x2)</span>
              </div>
              <div v-if="bestPair" class="hl-content">
                <span class="hl-main">{{ bestPair.bot1Name }} + {{ bestPair.bot2Name }}</span>
                <span class="hl-sub mono">{{ bestPair.winRate }}% побед ({{ bestPair.totalGames }} партий)</span>
              </div>
              <div v-else class="hl-empty dim tiny">Пока недостаточно матчей</div>
            </div>

            <div class="highlight-card">
              <div class="hl-head">
                <AppIcon name="flag" :size="14" />
                <span class="hl-label">Слабейшая синергия (дуэт 2x2)</span>
              </div>
              <div v-if="worstPair && worstPair.pairKey !== bestPair?.pairKey" class="hl-content">
                <span class="hl-main">{{ worstPair.bot1Name }} + {{ worstPair.bot2Name }}</span>
                <span class="hl-sub mono">{{ worstPair.winRate }}% побед ({{ worstPair.totalGames }} партий)</span>
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
                :class="{ active: botViewMode === 'levels' }"
                @click="botViewMode = 'levels'"
              >
                По уровням силы (12 уровней)
              </button>
              <button
                type="button"
                class="tiny pill"
                :class="{ active: botViewMode === 'personalities' }"
                @click="botViewMode = 'personalities'"
              >
                По стилям (12 персоналий)
              </button>
            </div>

            <div class="tab-pills opponent-pills">
              <button
                type="button"
                class="tiny pill"
                :class="{ active: botTab === 'human' }"
                @click="botTab = 'human'"
              >
                Против людей
              </button>
              <button
                type="button"
                class="tiny pill"
                :class="{ active: botTab === 'bot' }"
                @click="botTab = 'bot'"
              >
                ИИ vs ИИ (Демо/Тюнинг)
              </button>
            </div>
          </div>

          <!-- Таблица 1: По уровням силы (12 уровней) -->
          <div v-if="botViewMode === 'levels'" class="table-wrap">
            <table class="club">
              <thead>
                <tr>
                  <th>Уровень</th>
                  <th>Номинал Elo</th>
                  <th>Игр</th>
                  <th>В / П / Н</th>
                  <th>Win Rate</th>
                  <th>Мат / Флаг / Пат</th>
                  <th>Ср. ходов</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="b in currentLevelMetrics"
                  :key="b.level"
                  :class="{ 'highlight-top': topLevel?.level === b.level && b.totalGames >= 1 }"
                >
                  <td>
                    <strong>Ур.{{ b.level }} {{ b.name }}</strong>
                    <span v-if="topLevel?.level === b.level && b.totalGames >= 1" class="top-tag mono">
                      Топ
                    </span>
                  </td>
                  <td class="mono">{{ b.elo }}</td>
                  <td class="mono dim">{{ b.totalGames }}</td>
                  <td class="mono dim">{{ b.wins }} / {{ b.losses }} / {{ b.draws }}</td>
                  <td>
                    <span
                      class="badge mono"
                      :class="{
                        ok: b.winRate >= 45 && b.winRate <= 65,
                        danger: b.winRate > 65,
                        dim: b.winRate < 45,
                      }"
                    >
                      {{ b.winRate }}%
                    </span>
                  </td>
                  <td class="mono dim">{{ b.checkmateCount }} / {{ b.timeoutCount }} / {{ b.stalemateCount }}</td>
                  <td class="mono dim">{{ b.avgMoves }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Таблица 2: По стилям (12 персоналий) -->
          <div v-else class="table-wrap">
            <table class="club">
              <thead>
                <tr>
                  <th>Персоналия</th>
                  <th>Стиль / тактика</th>
                  <th>Базовый Elo</th>
                  <th>Игр</th>
                  <th>В / П / Н</th>
                  <th>Win Rate</th>
                  <th>Мат / Флаг / Пат</th>
                  <th>Ср. ходов</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="p in currentPersonalityMetrics"
                  :key="p.username"
                  :class="{ 'highlight-top': topPersonality?.username === p.username && p.totalGames >= 1 }"
                >
                  <td>
                    <strong>{{ p.name }}</strong>
                    <span class="bot-badge tiny" style="margin-left: 6px;">
                      {{ p.badge }}
                    </span>
                    <span v-if="topPersonality?.username === p.username && p.totalGames >= 1" class="top-tag mono">
                      Топ
                    </span>
                  </td>
                  <td class="dim tiny">{{ p.description }}</td>
                  <td class="mono">{{ p.defaultElo }}</td>
                  <td class="mono dim">{{ p.totalGames }}</td>
                  <td class="mono dim">{{ p.wins }} / {{ p.losses }} / {{ p.draws }}</td>
                  <td>
                    <span
                      class="badge mono"
                      :class="{
                        ok: p.winRate >= 45 && p.winRate <= 65,
                        danger: p.winRate > 65,
                        dim: p.winRate < 45,
                      }"
                    >
                      {{ p.winRate }}%
                    </span>
                  </td>
                  <td class="mono dim">{{ p.checkmateCount }} / {{ p.timeoutCount }} / {{ p.stalemateCount }}</td>
                  <td class="mono dim">{{ p.avgMoves }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="panel-head user-head">
        <div>
          <h3>Список пользователей</h3>
          <span class="hint">Управление аккаунтами и сброс рейтингов</span>
        </div>
      </div>

      <div v-if="error" class="panel-body">
        <p class="error-text">{{ error }}</p>
      </div>

      <div v-else-if="loading" class="empty">Загрузка игроков…</div>

      <div v-else class="table-wrap">
        <table class="club">
          <thead>
            <tr>
              <th style="width: 45px;">ID</th>
              <th>Статус</th>
              <th>Игрок</th>
              <th>Рейтинг</th>
              <th>В / П</th>
              <th>Партий</th>
              <th>Регистрация</th>
              <th>Роль</th>
              <th style="text-align: right;">Действия</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in users" :key="u.id" :class="{ 'is-me': u.id === auth.user?.id }">
              <td class="mono dim">{{ u.id }}</td>
              <td>
                <span class="dot" :class="{ on: u.online }" :title="u.online ? 'В сети' : 'Офлайн'"></span>
              </td>
              <td>
                <strong class="player-name">{{ u.username }}</strong>
                <span v-if="u.id === auth.user?.id" class="badge dim">Вы</span>
              </td>
              <td class="mono" style="font-weight: 700;">{{ u.rating }}</td>
              <td class="mono dim">{{ u.wins }} / {{ u.losses }}</td>
              <td class="mono dim">{{ u.games }}</td>
              <td class="mono dim">{{ fmtDate(u.createdAt) }}</td>
              <td>
                <button
                  class="small ghost"
                  :disabled="busyId === u.id || u.id === auth.user?.id"
                  @click="toggleAdmin(u)"
                  :title="u.isAdmin ? 'Снять права админа' : 'Сделать админом'"
                >
                  <span v-if="u.isAdmin" class="badge admin">Администратор</span>
                  <span v-else class="dim">Игрок</span>
                </button>
              </td>
              <td style="text-align: right;">
                <div class="admin-actions">
                  <button
                    class="small ghost"
                    :disabled="busyId === u.id"
                    @click="resetRating(u)"
                    title="Сбросить рейтинг на 1200"
                  >
                    <AppIcon name="rematch" :size="13" /> Сброс 1200
                  </button>

                  <button
                    v-if="u.id !== auth.user?.id"
                    class="small danger"
                    :disabled="busyId === u.id"
                    @click="deleteUser(u)"
                    title="Удалить аккаунт и все партии"
                  >
                    <AppIcon name="trash" :size="13" /> Удалить
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
