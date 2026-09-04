<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import type { GameSummary } from 'shared';
import { timeControlLabel } from 'shared';
import { api } from '../api/rest';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const tab = ref<'mine' | 'all'>('mine');
const games = ref<GameSummary[]>([]);
const loading = ref(true);
const lichessLoading = ref<number | null>(null);

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
  return m === 'bughouse' ? 'Багхаус' : '2×2 одна доска';
}

function meOf(g: GameSummary) {
  return g.participants.find((p) => p.userId === auth.user?.id);
}

function outcome(g: GameSummary): { text: string; cls: string } {
  if (g.status === 'abandoned' || g.result === '*') return { text: 'Брошена', cls: 'dim' };
  if (tab.value === 'all') {
    return { text: g.result === '1-0' ? 'Победа белых' : 'Победа черных', cls: '' };
  }
  const me = meOf(g);
  if (!me) return { text: g.result, cls: '' };
  const myTeamWon = (g.result === '1-0' && me.team === 1) || (g.result === '0-1' && me.team === 2);
  return myTeamWon ? { text: 'Победа', cls: 'win' } : { text: 'Поражение', cls: 'loss' };
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
  if (g.status === 'abandoned') return '';
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

async function analyzeOnLichess(gameId: number) {
  lichessLoading.value = gameId;
  try {
    const res = await api.post<{ url: string }>(`/api/games/${gameId}/lichess-import?board=0`, {});
    if (res.url) {
      window.open(res.url, '_blank');
    }
  } catch (e) {
    // fallback
    window.open(`/api/games/${gameId}/pgn?download=1`, '_blank');
    window.open('https://lichess.org/paste', '_blank');
  } finally {
    lichessLoading.value = null;
  }
}
</script>

<template>
  <div class="history-page">
    <div class="panel">
      <div class="panel-head">
        <div class="head-tabs">
          <button
            class="tab-btn"
            :class="{ active: tab === 'mine' }"
            @click="tab = 'mine'"
          >
            Мои партии
          </button>
          <button
            class="tab-btn"
            :class="{ active: tab === 'all' }"
            @click="tab = 'all'"
          >
            Архив клуба (все встречи)
          </button>
        </div>
        <span class="hint">{{ games.length }} записей</span>
      </div>

      <div v-if="loading" class="empty">Загрузка партий…</div>

      <div v-else-if="!games.length" class="empty">
        <p>Партий пока не найдено.</p>
        <router-link to="/" class="button primary">Перейти к столам</router-link>
      </div>

      <div v-else class="table-wrap">
        <table class="club">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Режим</th>
              <th>Контроль</th>
              <th>Команда 1 (белые)</th>
              <th>Команда 2 (черные)</th>
              <th>Итог</th>
              <th v-if="tab === 'mine'">Рейтинг</th>
              <th style="text-align: right;">Действия</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="g in games" :key="g.id">
              <td class="mono dim">{{ fmtDate(g.startedAt) }}</td>
              <td>
                <span class="badge">{{ modeLabel(g.mode) }}</span>
              </td>
              <td class="mono dim">{{ timeControlLabel(g.timeControl) }}</td>
              <td style="font-weight: 500;">{{ formatTeams(g).t1 }}</td>
              <td style="font-weight: 500;">{{ formatTeams(g).t2 }}</td>
              <td :class="outcome(g).cls" style="font-weight: 600;">
                {{ outcome(g).text }}
              </td>
              <td v-if="tab === 'mine'" class="mono" :class="deltaClass(g)" style="font-weight: 700;">
                {{ deltaText(g) }}
              </td>
              <td style="text-align: right;">
                <div class="actions-cell">
                  <router-link
                    v-if="g.status !== 'active'"
                    :to="`/replay/${g.id}`"
                    class="button small ghost"
                    title="Интерактивный плеер"
                  >
                    Плеер
                  </router-link>

                  <a
                    :href="`/api/games/${g.id}/pgn?download=1`"
                    class="button small ghost"
                    title="Скачать PGN файл"
                    download
                  >
                    PGN
                  </a>

                  <button
                    class="button small brass"
                    :disabled="lichessLoading === g.id"
                    @click="analyzeOnLichess(g.id)"
                    title="Импортировать и разобрать партию на Lichess"
                  >
                    {{ lichessLoading === g.id ? '…' : 'Lichess ↗' }}
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
.history-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.head-tabs {
  display: flex;
  gap: 8px;
}

.tab-btn {
  background: transparent;
  border: 1px solid transparent;
  color: var(--ink-faint);
  padding: 6px 14px;
  border-radius: var(--r-s);
  font-size: 14px;
  font-weight: 600;
}
.tab-btn:hover {
  color: var(--ink);
}
.tab-btn.active {
  background: var(--bg-raised);
  border-color: var(--line-strong);
  color: var(--brass);
}

.table-wrap {
  overflow-x: auto;
}

.win { color: var(--ok); }
.loss { color: var(--bad); }

.actions-cell {
  display: inline-flex;
  gap: 6px;
  justify-content: flex-end;
}
</style>
