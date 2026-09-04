<script setup lang="ts">
import { onMounted, onBeforeUnmount, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { LobbySummary, LiveGameInfo } from 'shared';
import { timeControlLabel } from 'shared';
import { getSocket } from '../api/socket';
import { api } from '../api/rest';
import ChessBoard from '../components/ChessBoard.vue';

const router = useRouter();
const lobbies = ref<LobbySummary[]>([]);
const liveGames = ref<LiveGameInfo[]>([]);
const showCreate = ref(false);
const showJoin = ref(false);

// форма создания лобби
const form = reactive({
  name: '',
  mode: 'bughouse' as 'bughouse' | 'team',
  tcIndex: 1,
  isPrivate: false,
});
const TC_PRESETS: { label: string; tc: { kind: 'none' | 'clock'; baseMin: number; incSec: number } }[] = [
  { label: 'Без часов', tc: { kind: 'none', baseMin: 0, incSec: 0 } },
  { label: '3+2', tc: { kind: 'clock', baseMin: 3, incSec: 2 } },
  { label: '5+0', tc: { kind: 'clock', baseMin: 5, incSec: 0 } },
  { label: '10+5', tc: { kind: 'clock', baseMin: 10, incSec: 5 } },
];

const joinCode = ref('');
const createError = ref('');
const joinError = ref('');

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
      notifyBrowser(`Вас приглашают: ${n.lobbyName ?? 'лобби'}`);
      // перейти в лобби можно кликом на toast — для простоты звук+уведомление
      pendingInvite.value = n.lobbyId;
      showToast(`Приглашение: ${n.lobbyName ?? 'лобби'} — открыть?`, () => {
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
const pendingInvite = ref<string | null>(null);
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
  } catch {
    /* ignore */
  }
}

// ---------- Действия ----------

async function createLobby(): Promise<void> {
  createError.value = '';
  try {
    const tc = TC_PRESETS[form.tcIndex].tc;
    const res = await api.post<{ lobby: LobbySummary; code: string }>('/api/lobbies', {
      name: form.name.trim() || `Лобби ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`,
      mode: form.mode,
      timeControl: tc,
      private: form.isPrivate,
    });
    showCreate.value = false;
    socket.emit('lobby:join', res.code, () => {
      void router.push(`/lobby/${res.lobby.id}`);
    });
  } catch (e) {
    createError.value = e instanceof Error ? e.message : 'Ошибка';
  }
}

async function joinByCode(): Promise<void> {
  joinError.value = '';
  try {
    const code = joinCode.value.trim().toUpperCase();
    const res = await api.post<{ lobby: LobbySummary }>('/api/lobbies/join', { code });
    socket.emit('lobby:join', code, () => {
      void void router.push(`/lobby/${res.lobby.id}`);
    });
  } catch (e) {
    joinError.value = e instanceof Error ? e.message : 'Ошибка';
  }
}

function enterLobby(l: LobbySummary): void {
  socket.emit('lobby:join', l.id, (ack) => {
    if (ack.ok && ack.data) router.push(`/lobby/${ack.data.lobby.id}`);
  });
}

function modeLabel(m: string): string {
  return m === 'bughouse' ? 'Багхаус' : '2 на 2';
}
</script>

<template>
  <div class="home">
    <div class="home-grid">
      <!-- Левая колонка: live-партии -->
      <section class="live-col">
        <div class="panel">
          <div class="panel-head">
            <h2>Сейчас играют</h2>
            <span class="hint" v-if="liveGames.length">{{ liveGames.length }} партий</span>
          </div>
          <div class="panel-body live-list" v-if="liveGames.length">
            <article v-for="g in liveGames" :key="g.gameId" class="live-game" @click="router.push(`/game/${g.gameId}`)">
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
                    {{ g.players.filter((p) => p.team === 1).map((p) => p.username).join(' и ') }}
                  </span>
                  <span class="vs">vs</span>
                  <span class="team t2">
                    {{ g.players.filter((p) => p.team === 2).map((p) => p.username).join(' и ') }}
                  </span>
                </div>
                <div class="meta-row">
                  <span class="badge">{{ modeLabel(g.mode) }}</span>
                  <span class="mono dim">ход {{ Math.ceil(g.moveNumber / (g.mode === 'bughouse' ? 1 : 2)) }}</span>
                </div>
              </div>
            </article>
          </div>
          <div v-else class="empty">
            Сейчас никто не играет.
            <span class="hint">Создайте лобби — и ваша партия появится здесь.</span>
          </div>
        </div>
      </section>

      <!-- Правая колонка: лобби + действия -->
      <section class="lobbies-col">
        <div class="panel">
          <div class="panel-head">
            <h2>Открытые лобби</h2>
            <div class="actions">
              <button class="primary" @click="showCreate = !showCreate">Создать лобби</button>
              <button @click="showJoin = !showJoin">По коду</button>
            </div>
          </div>

          <div v-if="showCreate" class="panel-body create-form">
            <div class="form-row">
              <label class="field-label">Название</label>
              <input v-model="form.name" placeholder="Пятничные партии" maxlength="40" />
            </div>
            <div class="form-row">
              <label class="field-label">Режим</label>
              <div class="radio-row">
                <label class="radio"><input type="radio" value="bughouse" v-model="form.mode" /> Багхаус</label>
                <label class="radio"><input type="radio" value="team" v-model="form.mode" /> Одна доска 2×2</label>
              </div>
            </div>
            <div class="form-row">
              <label class="field-label">Контроль времени</label>
              <div class="radio-row">
                <label v-for="(p, i) in TC_PRESETS" :key="p.label" class="radio chip">
                  <input type="radio" :value="i" v-model="form.tcIndex" /> {{ p.label }}
                </label>
              </div>
            </div>
            <div class="form-row">
              <label class="radio"><input type="checkbox" v-model="form.isPrivate" /> Приватное (не видно в списке, вход по коду)</label>
            </div>
            <p v-if="createError" class="error-text">{{ createError }}</p>
            <button class="primary" @click="createLobby">Создать</button>
          </div>

          <div v-if="showJoin" class="panel-body join-form">
            <div class="join-row">
              <input v-model="joinCode" class="mono" placeholder="КОД ЛОББИ" maxlength="6" style="text-transform: uppercase; letter-spacing: 0.15em;" />
              <button class="primary" @click="joinByCode">Войти</button>
            </div>
            <p v-if="joinError" class="error-text">{{ joinError }}</p>
          </div>

          <div class="panel-body lobby-rows" v-if="lobbies.length">
            <div v-for="l in lobbies" :key="l.id" class="lobby-row" @click="enterLobby(l)">
              <div class="lobby-main">
                <div class="lobby-name">{{ l.name }}</div>
                <div class="lobby-players">
                  <span v-for="p in l.players" :key="p.userId" class="lp" :class="{ dim: !p.online }">
                    {{ p.username }} <span class="mono">{{ p.rating }}</span>
                  </span>
                  <span v-for="s in 4 - l.players.length" :key="'slot' + s" class="lp empty">+ свободно</span>
                </div>
              </div>
              <div class="lobby-side">
                <span class="badge">{{ modeLabel(l.mode) }}</span>
                <span class="mono dim">{{ timeControlLabel(l.timeControl) }}</span>
                <span class="mono dim">{{ l.players.length }}/4</span>
                <button class="small">Войти</button>
              </div>
            </div>
          </div>
          <div v-else class="empty">
            Открытых лобби нет — создайте первое.
          </div>
        </div>
      </section>
    </div>

    <!-- Toast -->
    <div v-if="toast" class="toast" role="status">
      <span>{{ toast.text }}</span>
      <button v-if="toast.action" class="primary small" @click="toast.action?.(); toast = null">Открыть</button>
      <button class="small" @click="toast = null">Позже</button>
    </div>
  </div>
</template>

<style scoped>
.home-grid {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 20px;
  align-items: start;
}

@media (max-width: 900px) {
  .home-grid { grid-template-columns: 1fr; }
}

.live-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.live-game {
  cursor: pointer;
  border: 1px solid var(--line);
  border-radius: var(--r-m);
  padding: 10px;
  background: var(--bg);
  transition: border-color 0.12s ease;
}

.live-game:hover { border-color: var(--brass-strong); }

.live-boards {
  display: grid;
  gap: 6px;
}

.live-boards.two {
  grid-template-columns: 1fr 1fr;
}

.live-meta { margin-top: 8px; }

.players-line {
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.players-line .vs { color: var(--ink-faint); font-size: 12px; }

.team.t1 { color: var(--ink); font-weight: 500; }
.team.t2 { color: var(--ink); font-weight: 500; }

.meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}

.dim { color: var(--ink-faint); }

/* Лобби */
.actions { display: flex; gap: 8px; }

.create-form, .join-form { border-bottom: 1px solid var(--line); background: var(--bg); }

.radio-row { display: flex; gap: 10px; flex-wrap: wrap; }

.radio { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; cursor: pointer; }

.radio.chip {
  border: 1px solid var(--line-strong);
  padding: 4px 10px;
  border-radius: 999px;
}

.radio.chip:has(input:checked) {
  border-color: var(--felt);
  background: color-mix(in srgb, var(--felt) 8%, #fff);
}

.join-row { display: flex; gap: 8px; }

.lobby-rows { display: flex; flex-direction: column; padding: 8px 16px 16px; }

.lobby-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 8px;
  border-bottom: 1px solid var(--line);
  cursor: pointer;
  border-radius: var(--r-s);
}

.lobby-row:last-child { border-bottom: none; }
.lobby-row:hover { background: color-mix(in srgb, var(--brass) 7%, transparent); }

.lobby-name { font-weight: 600; }

.lobby-players {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin-top: 2px;
  font-size: 13px;
}

.lp { color: var(--ink-soft); }
.lp.dim { opacity: 0.55; }
.lp.empty { color: var(--ink-faint); font-style: italic; }

.lobby-side {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

/* Toast */
.toast {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--felt-deep);
  color: var(--paper);
  border: 1px solid var(--brass);
  border-radius: var(--r-m);
  padding: 10px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: var(--shadow-m);
  z-index: 100;
  font-size: 14px;
}

button.small { padding: 4px 10px; font-size: 13px; }
</style>
