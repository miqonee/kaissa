<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { AdminUserRow } from 'shared';
import { api } from '../api/rest';
import { useAuthStore } from '../stores/auth';
import AppIcon from '../components/AppIcon.vue';

const auth = useAuthStore();
const users = ref<AdminUserRow[]>([]);
const loading = ref(true);
const error = ref('');
const busyId = ref<number | null>(null);

async function loadUsers() {
  loading.value = true;
  error.value = '';
  try {
    const res = await api.get<{ users: AdminUserRow[] }>('/api/admin/users');
    users.value = res.users;
  } catch (e: any) {
    error.value = e.message || 'Ошибка загрузки игроков';
  } finally {
    loading.value = false;
  }
}

onMounted(loadUsers);

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
    await loadUsers();
  }
}

async function resetRating(u: AdminUserRow) {
  if (!confirm(`Сбросить рейтинг и победы игрока «${u.username}» на 1200?`)) return;
  busyId.value = u.id;
  try {
    await api.post(`/api/admin/users/${u.id}/reset`, {});
    await loadUsers();
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
    await loadUsers();
  } catch (e: any) {
    alert(e.message || 'Ошибка смены прав');
  } finally {
    busyId.value = null;
  }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}
</script>

<template>
  <div class="admin-page">
    <div class="panel">
      <div class="panel-head">
        <div>
          <h2>Панель администратора</h2>
          <span class="hint">Управление игроками для тестирования и балансировки</span>
        </div>
        <button class="small ghost" @click="loadUsers">
          <AppIcon name="refresh" :size="14" /> Обновить
        </button>
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

.is-me {
  background: color-mix(in srgb, var(--accent-2) 6%, transparent);
}

.admin-actions {
  display: inline-flex;
  gap: 6px;
  justify-content: flex-end;
}
</style>
