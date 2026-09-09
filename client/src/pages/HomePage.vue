<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { LobbySummary, LiveGameInfo, GameMode, TimeControl, TeamMode } from 'shared';
import { timeControlLabel } from 'shared';
import { getSocket, onSocketResync } from '../api/socket';
import { api } from '../api/rest';
import { useAuthStore } from '../stores/auth';
import ChessBoard from '../components/ChessBoard.vue';
import CreateLobbyModal from '../components/CreateLobbyModal.vue';
import AppIcon from '../components/AppIcon.vue';

const router = useRouter();
const auth = useAuthStore();
const lobbies = ref<LobbySummary[]>([]);
const liveGames = ref<LiveGameInfo[]>([]);

const autoLobby = computed(() => lobbies.value.find((l) => l.isAuto));
const userLobbies = computed(() => lobbies.value.filter((l) => !l.isAuto));

const showCreateModal = ref(false);
const createBusy = ref(false);
const createError = ref('');

const joinCode = ref('');
const joinError = ref('');
const joinBusy = ref(false);

const socket = getSocket();

onMounted(async () => {
  try {
    const res = await api.get<{ lobbies: LobbySummary[] }>('/api/lobbies');
    if (res.lobbies) lobbies.value = res.lobbies;
  } catch {}
  socket.emit('live:subscribe');
  socket.emit('lobby-list:subscribe');
  // Реконнект сокета теряет комнаты live/lobby-list — подписаться заново
  offResync = onSocketResync(() => {
    socket.emit('live:subscribe');
    socket.emit('lobby-list:subscribe');
  });
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

let offResync: (() => void) | null = null;

onBeforeUnmount(() => {
  offResync?.();
  offResync = null;
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

function openCreateModal(): void {
  if (!auth.user) {
    router.push({ name: 'login', query: { redirect: '/' } });
    return;
  }
  showCreateModal.value = true;
}

async function handleCreate(payload: { name: string; mode: GameMode; timeControl: TimeControl; isPrivate: boolean; teamMode?: TeamMode }) {
  if (!auth.user) {
    router.push({ name: 'login', query: { redirect: '/' } });
    return;
  }
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
  if (!auth.user) {
    router.push({ name: 'login', query: { redirect: '/' } });
    return;
  }
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
  if (!auth.user) {
    router.push({ name: 'login', query: { redirect: `/lobby/${l.id}` } });
    return;
  }
  socket.emit('lobby:join', l.id, (ack) => {
    if (ack.ok && ack.data) router.push(`/lobby/${ack.data.lobby.id}`);
  });
}

function modeLabel(m: string): string {
  return m === 'bughouse' ? 'Багхаус' : '2×2 одна доска';
}

function teamAvgRating(players: { team: number; rating: number }[], team: number): number {
  const tp = players.filter((p) => p.team === team);
  if (!tp.length) return 1200;
  return Math.round(tp.reduce((s, p) => s + p.rating, 0) / tp.length);
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
        <button class="primary banner-create-btn" @click="openCreateModal">
          <AppIcon name="plus" :size="18" :stroke-width="2.4" />
          Создать стол
        </button>

        <form class="quick-join" @submit.prevent="joinByCode">
          <input
            v-model="joinCode"
            placeholder="КОД СТОЛА"
            maxlength="6"
            class="mono join-input"
          />
          <button type="submit" class="brass join-btn" :disabled="!joinCode.trim() || joinBusy">
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
                    <small class="mono dim">({{ teamAvgRating(g.players, 1) }})</small>
                  </span>
                  <span class="vs">vs</span>
                  <span class="team t2">
                    {{ g.players.filter((p) => p.team === 2).map((p) => p.username).join(' / ') }}
                    <small class="mono dim">({{ teamAvgRating(g.players, 2) }})</small>
                  </span>
                </div>
                <div class="meta-row">
                  <span class="badge">{{ modeLabel(g.mode) }}</span>
                  <span class="mono dim">ход {{ Math.ceil(g.moveNumber / (g.mode === 'bughouse' ? 1 : 2)) }}</span>
                  <span class="spectate-hint">
                    <AppIcon name="eye" :size="14" /> Смотреть
                  </span>
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
            <!-- Быстрый стол 2х2 (закреплён во главе) -->
            <div
              v-if="autoLobby"
              class="lobby-card auto-lobby-card"
              @click="enterLobby(autoLobby)"
            >
              <div class="lobby-card-main">
                <div class="lobby-title-row">
                  <span class="lobby-name">{{ autoLobby.name }}</span>
                  <span class="badge auto-chip">
                    <AppIcon name="bolt" :size="12" /> Быстрый старт
                  </span>
                </div>
                <div class="lobby-players">
                  <span
                    v-for="p in autoLobby.players"
                    :key="p.userId"
                    class="lp"
                    :class="{ offline: !p.online }"
                  >
                    <span class="dot" :class="p.isBot ? 'bot-dot' : 'on'"></span>
                    {{ p.username }}
                    <span class="mono dim">({{ p.rating }})</span>
                  </span>
                </div>
              </div>

              <div class="lobby-card-meta">
                <div class="tags">
                  <span class="badge">{{ modeLabel(autoLobby.mode) }}</span>
                  <span class="badge mono">{{ timeControlLabel(autoLobby.timeControl) }}</span>
                </div>
                <button class="brass small" @click.stop="enterLobby(autoLobby)">
                  <AppIcon name="bolt" :size="14" /> Сесть за стол
                </button>
              </div>
            </div>

            <!-- Открытые пользовательские столы -->
            <div
              v-for="l in userLobbies"
              :key="l.id"
              class="lobby-card"
              @click="enterLobby(l)"
            >
              <div class="lobby-card-main">
                <div class="lobby-title-row">
                  <span class="lobby-name">{{ l.name }}</span>
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
                </div>
              </div>

              <div class="lobby-card-meta">
                <div class="tags">
                  <span class="badge">{{ modeLabel(l.mode) }}</span>
                  <span class="badge mono">{{ timeControlLabel(l.timeControl) }}</span>
                </div>
                <span class="seats-indicator" :title="`${l.players.length} из 4 мест занято`">
                  <span
                    v-for="s in 4"
                    :key="s"
                    class="seat-pip"
                    :class="{ filled: s <= l.players.length }"
                  ></span>
                  <span class="seats mono">{{ l.players.length }}/4</span>
                </span>
                <button class="primary small" @click.stop="enterLobby(l)">Сесть за стол</button>
              </div>
            </div>
          </div>

          <div v-else class="empty">
            <p>Открытых столов пока нет.</p>
            <button class="primary" @click="openCreateModal">Создать свой стол</button>
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
  background: linear-gradient(135deg, var(--surface) 0%, color-mix(in srgb, var(--felt) 12%, var(--surface)) 100%);
  border-color: color-mix(in srgb, var(--accent-2) 35%, var(--line));
}

.banner-intro h1 {
  font-size: 26px;
  margin-bottom: 4px;
}

.banner-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.banner-create-btn {
  height: 42px;
  padding: 0 20px;
  font-size: 14.5px;
  font-weight: 600;
  border-radius: var(--r-s);
  box-sizing: border-box;
}

.quick-join {
  display: flex;
  align-items: center;
  gap: 6px;
}

.join-input {
  height: 42px;
  width: 140px;
  padding: 0 12px;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-weight: 600;
  text-align: center;
  border-radius: var(--r-s);
  box-sizing: border-box;
}

.join-btn {
  height: 42px;
  padding: 0 18px;
  font-size: 14px;
  font-weight: 600;
  border-radius: var(--r-s);
  box-sizing: border-box;
}

.banner-error {
  width: 100%;
  margin: 0;
}

.home-grid {
  display: grid;
  grid-template-columns: 1.05fr 1fr;
  gap: 24px;
  align-items: stretch;
}

/* Обе колонки визуально завершены: панели растягиваются на высоту сетки */
.live-col,
.lobbies-col {
  display: flex;
  min-width: 0;
}

.live-col > .panel,
.lobbies-col > .panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.lobbies-col > .panel > .panel-body,
.live-col > .panel > .panel-body,
.lobbies-col > .panel > .empty {
  flex: 1;
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
  background: var(--surface-inset);
  transition: all 0.15s;
}

.live-game:hover {
  border-color: var(--accent-2);
  background: var(--surface-2);
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
  color: var(--ink-3);
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
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--accent);
  font-weight: 600;
}

.live-game:hover .spectate-hint {
  color: var(--accent-2);
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
  background: var(--surface-inset);
  cursor: pointer;
  transition: all 0.15s;
}

.lobby-card:hover {
  border-color: var(--accent-2);
  background: var(--surface-2);
}

.auto-lobby-card {
  border-color: color-mix(in srgb, var(--accent) 55%, var(--line));
  background: linear-gradient(135deg, var(--surface-inset) 0%, color-mix(in srgb, var(--felt) 10%, var(--surface-inset)) 100%);
}

.auto-lobby-card:hover {
  border-color: var(--accent);
  background: var(--surface-2);
}

.auto-chip {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  color: var(--accent);
  border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.bot-dot {
  background: var(--ink-3);
  box-shadow: none;
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  color: var(--ink-2);
}

.lp.offline {
  opacity: 0.55;
}

.lp.empty {
  color: var(--ink-3);
  font-style: italic;
}

.seats-indicator {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 3px 9px;
  border-radius: 999px;
  background: var(--surface-2);
  border: 1px solid var(--line);
}

.seat-pip {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--line-2);
  transition: background var(--t-fast), box-shadow var(--t-fast);
}

.seat-pip.filled {
  background: var(--ok);
  box-shadow: 0 0 4px color-mix(in srgb, var(--ok) 60%, transparent);
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
  font-size: 12.5px;
  color: var(--ink-2);
  font-weight: 700;
}

/* На узких экранах карточка стола и баннер перестраиваются вертикально */
@media (max-width: 560px) {
  .home-banner {
    padding: 16px 14px;
    gap: 14px;
  }

  .banner-intro h1 {
    font-size: 20px;
  }

  .banner-actions {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }

  .banner-create-btn {
    width: 100%;
  }

  .quick-join {
    width: 100%;
  }

  .join-input {
    flex: 1;
    width: auto;
  }

  .lobby-card {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .lobby-card-meta {
    justify-content: space-between;
  }

  .lobby-card-meta .tags {
    flex-wrap: wrap;
  }
}

/* Компактное пустое состояние: по центру, без раздутых отступов */
.lobbies-col .empty,
.live-col .empty {
  padding: 28px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin: auto;
}

/* Toast */
.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--surface-2);
  color: var(--ink);
  border: 1px solid var(--accent-2);
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
