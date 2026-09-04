<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { LobbySummary, LiveGameInfo, GameMode, TimeControl } from 'shared';
import { timeControlLabel } from 'shared';
import { getSocket } from '../api/socket';
import { api } from '../api/rest';
import ChessBoard from '../components/ChessBoard.vue';
import CreateLobbyModal from '../components/CreateLobbyModal.vue';

const router = useRouter();
const lobbies = ref<LobbySummary[]>([]);
const liveGames = ref<LiveGameInfo[]>([]);

const showCreateModal = ref(false);
const createBusy = ref(false);
const createError = ref('');

const joinCode = ref('');
const joinError = ref('');
const joinBusy = ref(false);

const socket = getSocket();

onMounted(() => {
  socket.emit('live:subscribe');
  socket.emit('lobby-list:subscribe');
  socket.on('lobby:list:update', (list) => (lobbies.value = list));
  socket.on('live:snapshot', (games) => (liveGames.value = games));
  socket.on('live:new', (g) => {
    liveGames.value = [g, ...liveGames.value.filter((x) => x.gameId !== g.gameId)];
  });
  socket.on('live:update', (g) => {
    const i = liveGames.value.findIndex((x) => x.gameId === g.gameId);
    if (i >= 0) liveGames.value.splice(i, 1, g);
    else liveGames.value.unshift(g);
  });
  socket.on('live:end', ({ gameId }) => {
    liveGames.value = liveGames.value.filter((x) => x.gameId !== gameId);
  });
  socket.on('user:notif', (n) => {
    if (n.type === 'lobby_invite' || n.type === 're_match' || n.type === 'game_invite') {
      notifyBrowser(`Вас зовут в стол: ${n.lobbyName ?? 'лобби'}`);
      showToast(`Приглашение в стол «${n.lobbyName ?? 'лобби'}»`, () => {
        router.push(`/lobby/${n.lobbyId}`);
      });
    }
  });
});

onBeforeUnmount(() => {
  socket.off('lobby:list:update');
  socket.off('live:snapshot');
  socket.off('live:new');
  socket.off('live:update');
  socket.off('live:end');
  socket.off('user:notif');
});

// ---------- Toast ----------
const toast = ref<{ text: string; action?: () => void } | null>(null);
let toastTimer: number | undefined;

function showToast(text: string, action?: () => void): void {
  toast.value = { text, action };
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toast.value = null), 12000);
}

function notifyBrowser(text: string): void {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Каисса', { body: text, icon: '/favicon.svg' });
    }
  } catch {}
}

// ---------- Создание и вход ----------

async function handleCreate(payload: { name: string; mode: GameMode; timeControl: TimeControl; isPrivate: boolean }) {
  createError.value = '';
  createBusy.value = true;
  try {
    const res = await api.post<{ lobby: LobbySummary; code: string }>('/api/lobbies', payload);
    showCreateModal.value = false;
    socket.emit('lobby:join', res.code, () => {
      router.push(`/lobby/${res.lobby.id}`);
    });
  } catch (e: any) {
    createError.value = e.message || 'Ошибка создания лобби';
  } finally {
    createBusy.value = false;
  }
}

async function joinByCode(): Promise<void> {
  const code = joinCode.value.trim().toUpperCase();
  if (!code) return;
  joinError.value = '';
  joinBusy.value = true;
  try {
    const res = await api.post<{ lobby: LobbySummary }>('/api/lobbies/join', { code });
    socket.emit('lobby:join', code, () => {
      router.push(`/lobby/${res.lobby.id}`);
    });
  } catch (e: any) {
    joinError.value = e.message || 'Стол не найден';
  } finally {
    joinBusy.value = false;
  }
}

function enterLobby(l: LobbySummary): void {
  socket.emit('lobby:join', l.id, (ack) => {
    if (ack.ok && ack.data) router.push(`/lobby/${ack.data.lobby.id}`);
  });
}

function modeLabel(m: string): string {
  return m === 'bughouse' ? 'Багхаус' : '2×2 одна доска';
}
</script>

<template>
  <div class="home">
    <!-- Верхний баннер с быстрыми действиями -->
    <div class="home-banner panel">
      <div class="banner-intro">
        <h1>Командный шахматный клуб</h1>
        <p class="dim">Играйте парами на одной доске или в багхаус с обменом фигурами в реальном времени.</p>
      </div>
      <div class="banner-actions">
        <button class="primary big" @click="showCreateModal = true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
          Создать стол
        </button>

        <form class="quick-join" @submit.prevent="joinByCode">
          <input
            v-model="joinCode"
            placeholder="КОД СТОЛА"
            maxlength="6"
            class="mono join-input"
          />
          <button type="submit" class="brass" :disabled="!joinCode.trim() || joinBusy">
            Войти
          </button>
        </form>
      </div>
      <p v-if="joinError" class="error-text banner-error">{{ joinError }}</p>
    </div>

    <!-- Основная сетка -->
    <div class="home-grid">
      <!-- Текущие live-партии (Lichess TV style) -->
      <section class="live-col">
        <div class="panel">
          <div class="panel-head">
            <h2>Сейчас в игре</h2>
            <span class="badge on" v-if="liveGames.length">{{ liveGames.length }} партий</span>
            <span class="hint" v-else>нет активных</span>
          </div>

          <div class="panel-body live-list" v-if="liveGames.length">
            <article
              v-for="g in liveGames"
              :key="g.gameId"
              class="live-game"
              @click="router.push(`/game/${g.gameId}`)"
            >
              <div class="live-boards" :class="{ two: g.mode === 'bughouse' }">
                <ChessBoard
                  v-for="(fen, i) in g.fens"
                  :key="i"
                  :fen="fen"
                  :mini="true"
                  :coordinates="false"
                  :movable-color="null"
                />
              </div>
              <div class="live-meta">
                <div class="players-line">
                  <span class="team t1">
                    {{ g.players.filter((p) => p.team === 1).map((p) => p.username).join(' / ') }}
                  </span>
                  <span class="vs">vs</span>
                  <span class="team t2">
                    {{ g.players.filter((p) => p.team === 2).map((p) => p.username).join(' / ') }}
                  </span>
                </div>
                <div class="meta-row">
                  <span class="badge">{{ modeLabel(g.mode) }}</span>
                  <span class="mono dim">ход {{ Math.ceil(g.moveNumber / (g.mode === 'bughouse' ? 1 : 2)) }}</span>
                  <span class="spectate-hint">Смотреть →</span>
                </div>
              </div>
            </article>
          </div>

          <div v-else class="empty">
            <p>Сейчас партий нет.</p>
            <span class="dim">Создайте лобби и начните первую встречу!</span>
          </div>
        </div>
      </section>

      <!-- Открытые столы -->
      <section class="lobbies-col">
        <div class="panel">
          <div class="panel-head">
            <h2>Открытые столы</h2>
            <span class="hint">{{ lobbies.length }} открыто</span>
          </div>

          <div class="panel-body lobby-rows" v-if="lobbies.length">
            <div
              v-for="l in lobbies"
              :key="l.id"
              class="lobby-card"
              @click="enterLobby(l)"
            >
              <div class="lobby-card-main">
                <div class="lobby-title-row">
                  <span class="lobby-name">{{ l.name }}</span>
                  <span class="lobby-code-chip mono" title="Код для входа" @click.stop>
                    {{ l.code }}
                  </span>
                </div>
                <div class="lobby-players">
                  <span
                    v-for="p in l.players"
                    :key="p.userId"
                    class="lp"
                    :class="{ offline: !p.online }"
                  >
                    <span class="dot" :class="{ on: p.online }"></span>
                    {{ p.username }}
                    <span class="mono dim">({{ p.rating }})</span>
                  </span>
                  <span
                    v-for="s in 4 - l.players.length"
                    :key="'slot' + s"
                    class="lp empty"
                  >
                    + свободно
                  </span>
                </div>
              </div>

              <div class="lobby-card-meta">
                <div class="tags">
                  <span class="badge">{{ modeLabel(l.mode) }}</span>
                  <span class="badge mono">{{ timeControlLabel(l.timeControl) }}</span>
                </div>
                <span class="seats mono">{{ l.players.length }}/4</span>
                <button class="primary small">Сесть за стол</button>
              </div>
            </div>
          </div>

          <div v-else class="empty">
            <p>Открытых столов пока нет.</p>
            <button class="primary" @click="showCreateModal = true">Создать свой стол</button>
          </div>
        </div>
      </section>
    </div>

    <!-- Модальное окно создания стола -->
    <CreateLobbyModal
      v-if="showCreateModal"
      :busy="createBusy"
      :error="createError"
      @close="showCreateModal = false"
      @create="handleCreate"
    />

    <!-- Toast уведомление -->
    <div v-if="toast" class="toast" role="status">
      <span>{{ toast.text }}</span>
      <button v-if="toast.action" class="brass small" @click="toast.action?.(); toast = null">Открыть</button>
      <button class="ghost small" @click="toast = null">Закрыть</button>
    </div>
  </div>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.home-banner {
  padding: 24px 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
  background: linear-gradient(135deg, var(--bg-card) 0%, color-mix(in srgb, var(--felt) 12%, var(--bg-card)) 100%);
  border-color: color-mix(in srgb, var(--brass) 35%, var(--line));
}

.banner-intro h1 {
  font-size: 26px;
  margin-bottom: 4px;
}

.banner-actions {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.quick-join {
  display: flex;
  gap: 6px;
}

.join-input {
  width: 140px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-weight: 600;
  text-align: center;
}

.banner-error {
  width: 100%;
  margin: 0;
}

.home-grid {
  display: grid;
  grid-template-columns: 1.05fr 1fr;
  gap: 24px;
  align-items: start;
}

@media (max-width: 980px) {
  .home-grid {
    grid-template-columns: 1fr;
  }
}

/* Live-партии */
.live-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

.live-game {
  cursor: pointer;
  border: 1px solid var(--line);
  border-radius: var(--r-m);
  padding: 14px;
  background: var(--bg-inset);
  transition: all 0.15s;
}

.live-game:hover {
  border-color: var(--brass);
  background: var(--bg-raised);
  transform: translateY(-1px);
}

.live-boards {
  display: grid;
  gap: 8px;
}

.live-boards.two {
  grid-template-columns: 1fr 1fr;
}

.live-meta {
  margin-top: 10px;
}

.players-line {
  font-size: 14px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.players-line .vs {
  color: var(--ink-faint);
  font-size: 12px;
  font-style: italic;
}

.team {
  color: var(--ink);
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  font-size: 12.5px;
}

.spectate-hint {
  margin-left: auto;
  color: var(--brass);
  font-weight: 600;
}

/* Карточки столов */
.lobby-rows {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
}

.lobby-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 14px 16px;
  border: 1px solid var(--line);
  border-radius: var(--r-m);
  background: var(--bg-inset);
  cursor: pointer;
  transition: all 0.15s;
}

.lobby-card:hover {
  border-color: var(--brass);
  background: var(--bg-raised);
}

.lobby-card-main {
  flex: 1;
  min-width: 0;
}

.lobby-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.lobby-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--ink);
}

.lobby-code-chip {
  background: var(--bg-card);
  border: 1px dashed var(--brass);
  color: var(--brass);
  padding: 1px 7px;
  border-radius: 4px;
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.lobby-players {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  font-size: 13px;
}

.lp {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--ink-soft);
}

.lp.offline {
  opacity: 0.55;
}

.lp.empty {
  color: var(--ink-faint);
  font-style: italic;
}

.lobby-card-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.lobby-card-meta .tags {
  display: flex;
  gap: 6px;
}

.seats {
  font-size: 13.5px;
  color: var(--ink-faint);
  font-weight: 600;
}

/* Toast */
.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--bg-raised);
  color: var(--ink);
  border: 1px solid var(--brass);
  border-radius: var(--r-m);
  padding: 12px 20px;
  display: flex;
  align-items: center;
  gap: 14px;
  box-shadow: var(--shadow-l);
  z-index: 2000;
  font-size: 14px;
}
</style>
