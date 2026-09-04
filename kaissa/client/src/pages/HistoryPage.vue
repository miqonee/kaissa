<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { GameSummary } from 'shared';
import { timeControlLabel } from 'shared';
import { api } from '../api/rest';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const games = ref<GameSummary[]>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    const res = await api.get<{ games: GameSummary[] }>('/api/games/mine');
    games.value = res.games;
  } catch {
    // не авторизован и т.п.
  } finally {
    loading.value = false;
  }
});

function modeLabel(m: string): string {
  return m === 'bughouse' ? 'Багхаус' : '2×2';
}

function meOf(g: GameSummary) {
  return g.participants.find((p) => p.userId === auth.user?.id);
}

function outcome(g: GameSummary): { text: string; cls: string } {
  if (g.status === 'abandoned' || g.result === '*') return { text: 'брошена', cls: 'dim' };
  const me = meOf(g);
  if (!me) return { text: '—', cls: 'dim' };
  const myTeamWon = (g.result === '1-0' && me.team === 1) || (g.result === '0-1' && me.team === 2);
  return myTeamWon ? { text: 'Победа', cls: 'win' } : { text: 'Поражение', cls: 'loss' };
}

function opponents(g: GameSummary): string {
  const me = meOf(g);
  const opp = g.participants.filter((p) => p.team !== me?.team);
  return opp.map((p) => p.username).join(' и ');
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
  return new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
</script>

<template>
  <div>
    <div class="panel">
      <div class="panel-head">
        <h2>История встреч</h2>
        <span class="hint">последние 50 партий</span>
      </div>
      <div v-if="loading" class="empty">Загрузка…</div>
      <div v-else-if="!games.length" class="empty">
        Партий пока не было. <router-link to="/">Создайте лобби</router-link> — и история появится.
      </div>
      <table v-else class="club">
        <thead>
          <tr>
            <th>Дата</th><th>Режим</th><th>Контроль</th><th>Соперники</th><th>Итог</th><th>Рейтинг</th><th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="g in games" :key="g.id">
            <td class="mono dim">{{ fmtDate(g.startedAt) }}</td>
            <td>{{ modeLabel(g.mode) }}</td>
            <td class="mono dim">{{ timeControlLabel(g.timeControl) }}</td>
            <td>{{ opponents(g) }}</td>
            <td :class="outcome(g).cls" style="font-weight: 600;">{{ outcome(g).text }}</td>
            <td class="mono" :class="deltaClass(g)">{{ deltaText(g) }}</td>
            <td>
              <router-link v-if="g.status !== 'active'" :to="`/replay/${g.id}`" class="small-link">просмотр</router-link>
              <span v-else class="badge on">идёт</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.win { color: var(--ok); }
.loss { color: var(--bad); }
.dim { color: var(--ink-faint); }
.small-link { font-size: 13px; }
</style>
