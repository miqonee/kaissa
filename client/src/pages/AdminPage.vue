<script setup lang="ts">
import { onMounted, ref } from 'vue';
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
    await api.post(`/api/admin/users/${u.id}`, undefined); // router handles DELETE
  } catch (e) {
    // try direct fetch for DELETE method
    const res = await fetch(`/api/admin/users/${u.id}`, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || 'Ошибка удаления');
    }
  } finally {
    busyId.value = null;
    await loadData();
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

      <!-- Балансировка ботов (5 уровней) -->
      <div v-if="metrics?.botMetrics?.length" class="panel-body bot-metrics-wrap">
        <h3 class="section-title">Балансировка ИИ-ботов (5 уровней)</h3>
        <div class="table-wrap">
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
              <tr v-for="b in metrics.botMetrics" :key="b.level">
                <td><strong>Ур.{{ b.level }} {{ b.name }}</strong></td>
                <td class="mono">{{ b.elo }}</td>
                <td class="mono dim">{{ b.totalGames }}</td>
                <td class="mono dim">{{ b.wins }} / {{ b.losses }} / {{ b.draws }}</td>
                <td>
                  <span
                    class="badge mono"
                    :class="{
                      ok: b.winRate >= 40 && b.winRate <= 60,
                      danger: b.winRate > 60,
                      dim: b.winRate < 40,
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

.bot-metrics-wrap {
  border-bottom: 1px solid var(--line);
  padding: 16px;
}

.section-title {
  margin: 0 0 12px 0;
  font-size: 16px;
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
