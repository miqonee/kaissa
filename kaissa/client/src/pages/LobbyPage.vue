<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { ChatMessage, LobbySummary } from 'shared';
import { timeControlLabel } from 'shared';
import { getSocket } from '../api/socket';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const socket = getSocket();

const lobby = ref<LobbySummary | null>(null);
const error = ref('');
const chat = ref<ChatMessage[]>([]);
const chatText = ref('');
const chatBox = ref<HTMLElement | null>(null);
const lobbyId = computed(() => String(route.params.id));

const me = computed(() => auth.user);
const isHost = computed(() => lobby.value?.players.find((p) => p.userId === auth.user?.id)?.host ?? false);
const iAmReady = computed(() => lobby.value?.players.find((p) => p.userId === auth.user?.id)?.ready ?? false);
const allReady = computed(() => lobby.value?.players.length === 4 && lobby.value.players.every((p) => p.ready));
const offlinePlayers = computed(() => lobby.value?.players.filter((p) => !p.online) ?? []);
const link = computed(() => `${location.origin}/lobby/${lobbyId.value}`);

function scrollChat(): void {
  setTimeout(() => {
    if (chatBox.value) chatBox.value.scrollTop = chatBox.value.scrollHeight;
  }, 30);
}

onMounted(() => {
  socket.emit('lobby:join', lobbyId.value, (ack) => {
    if (ack.ok && ack.data) {
      lobby.value = ack.data.lobby;
    } else {
      error.value = ack.error ?? 'Не удалось войти в лобби';
    }
  });

  socket.on('lobby:state', (state) => {
    if (state.id !== lobbyId.value) return;
    lobby.value = state;
  });
  socket.on('lobby:chat', (msg) => {
    chat.value.push(msg);
    scrollChat();
  });
  socket.on('lobby:started', ({ gameId }) => {
    router.push(`/game/${gameId}`);
  });
  socket.on('lobby:closed', (reason) => {
    error.value = reason;
  });
  socket.on('user:notif', (n) => {
    if (n.type === 'lobby_invite') {
      // Пользователь в другом лобби; показываем toast
      toastText.value = `Вас зовут в «${n.lobbyName}»`;
      toastAction.value = () => router.push(`/lobby/${n.lobbyId}`);
    }
  });
});

onBeforeUnmount(() => {
  socket.emit('lobby:leave');
  socket.off('lobby:state');
  socket.off('lobby:chat');
  socket.off('lobby:started');
  socket.off('lobby:closed');
  socket.off('user:notif');
});

function setReady(): void {
  socket.emit('lobby:ready', !iAmReady.value);
}

function kick(userId: number): void {
  if (confirm('Исключить игрока?')) socket.emit('lobby:kick', userId);
}

function summon(): void {
  if ('Notification' in window && Notification.permission === 'default') {
    void Notification.requestPermission();
  }
  socket.emit('lobby:summon');
  toastText.value = 'Участники призваны';
  setTimeout(() => (toastText.value = ''), 2500);
}

function start(): void {
  socket.emit('lobby:start', (ack) => {
    if (!ack.ok) {
      error.value = ack.error ?? 'Не удалось начать';
      setTimeout(() => (error.value = ''), 3000);
    }
  });
}

function sendChat(): void {
  const t = chatText.value.trim();
  if (!t) return;
  socket.emit('lobby:chat', t);
  chatText.value = '';
}

function copyLink(): void {
  void navigator.clipboard.writeText(link.value);
  toastText.value = 'Ссылка скопирована';
  setTimeout(() => (toastText.value = ''), 2000);
}

const toastText = ref('');
const toastAction = ref<(() => void) | null>(null);

function modeLabel(m: string): string {
  return m === 'bughouse' ? 'Багхаус' : 'Одна доска 2×2';
}
</script>

<template>
  <div v-if="error && !lobby" class="empty">{{ error }}</div>
  <div v-else-if="lobby" class="lobby-page">
    <div class="lobby-layout">
      <!-- Игроки -->
      <section class="panel players-panel">
        <div class="panel-head">
          <h2>{{ lobby.name }}</h2>
          <div class="head-badges">
            <span class="badge">{{ modeLabel(lobby.mode) }}</span>
            <span class="badge mono">{{ timeControlLabel(lobby.timeControl) }}</span>
          </div>
        </div>
        <div class="panel-body">
          <div class="slots">
            <div v-for="(p, i) in lobby.players" :key="p.userId" class="slot-row" :class="{ ready: p.ready }">
              <span class="slot-num mono">{{ i + 1 }}</span>
              <span class="dot" :class="{ on: p.online }" :title="p.online ? 'онлайн' : 'офлайн'"></span>
              <span class="slot-name">
                {{ p.username }}
                <span v-if="p.host" class="host-mark" title="хост">★</span>
              </span>
              <span class="slot-rating mono">{{ p.rating }}</span>
              <span class="badge" :class="p.ready ? 'on' : 'off'">{{ p.ready ? 'готов' : 'ждём' }}</span>
              <button v-if="isHost && p.userId !== me?.id" class="small danger" @click="kick(p.userId)">×</button>
            </div>
            <div v-for="i in 4 - lobby.players.length" :key="'empty' + i" class="slot-row empty-slot-row">
              <span class="slot-num mono">{{ lobby.players.length + i }}</span>
              <span class="slot-name dim">свободное место</span>
            </div>
          </div>

          <div class="invite-row">
            <button @click="copyLink">Скопировать ссылку</button>
            <button
              v-if="offlinePlayers.length"
              class="summon"
              @click="summon"
              title="Отправить уведомление офлайн-участникам"
            >
              Призвать ({{ offlinePlayers.length }})
            </button>
          </div>
        </div>
      </section>

      <!-- Чат -->
      <section class="panel chat-panel">
        <div class="panel-head"><h3>Чат лобби</h3></div>
        <div class="panel-body chat-body">
          <div ref="chatBox" class="chat-log">
            <div v-for="m in chat" :key="m.id" class="chat-msg">
              <span class="chat-user">{{ m.username }}:</span> {{ m.text }}
            </div>
            <div v-if="!chat.length" class="dim small-hint">Сообщений пока нет.</div>
          </div>
          <form class="chat-input" @submit.prevent="sendChat">
            <input v-model="chatText" placeholder="Сообщение…" maxlength="300" />
            <button class="primary">→</button>
          </form>
        </div>
      </section>
    </div>

    <!-- Старт -->
    <div class="start-bar">
      <p class="dim" v-if="lobby.players.length < 4">Ждём игроков: {{ lobby.players.length }} из 4. Отправьте им ссылку или код.</p>
      <p class="dim" v-else-if="!allReady">Все должны нажать «Готов».</p>
      <p class="dim" v-else>Команды будут сформированы по рейтингу автоматически.</p>
      <button v-if="isHost" class="primary big" :disabled="!allReady" @click="start">Начать игру</button>
      <span v-else class="dim small-hint">Хост начнёт игру, когда все будут готовы.</span>
      <button class="ready-btn" :class="{ 'ready-on': iAmReady }" @click="setReady">
        {{ iAmReady ? 'Готов ✓' : 'Я готов' }}
      </button>
    </div>

    <div v-if="toastText" class="toast">{{ toastText }}</div>
  </div>
  <div v-else class="empty">Загрузка лобби…</div>
</template>

<style scoped>
.lobby-layout {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 20px;
}

@media (max-width: 900px) {
  .lobby-layout { grid-template-columns: 1fr; }
}

.head-badges { display: flex; gap: 8px; }

.slots { display: flex; flex-direction: column; gap: 8px; }

.slot-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: var(--r-s);
  background: #fff;
}

.slot-row.ready { border-color: color-mix(in srgb, var(--ok) 45%, transparent); }

.slot-num { color: var(--ink-faint); width: 14px; }
.slot-name { font-weight: 500; flex: 1; }
.slot-rating { color: var(--ink-soft); }
.host-mark { color: var(--brass-strong); margin-left: 2px; }

.empty-slot-row { border-style: dashed; background: transparent; }
.empty-slot-row .slot-name { font-weight: 400; }

.invite-row {
  display: flex;
  gap: 10px;
  margin-top: 14px;
}

button.summon {
  background: var(--brass);
  border-color: var(--brass-strong);
  color: #fff;
  font-weight: 500;
}

button.summon:hover { background: var(--brass-strong); }

/* Чат */
.chat-body { display: flex; flex-direction: column; height: 320px; }
.chat-log { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; padding-right: 4px; }

.chat-msg { font-size: 14px; }
.chat-user { font-weight: 600; color: var(--felt); }

.chat-input { display: flex; gap: 8px; margin-top: 10px; }

.dim { color: var(--ink-faint); font-size: 14px; }
.small-hint { font-size: 13px; }

/* Старт-бар */
.start-bar {
  margin-top: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  justify-content: center;
  padding: 14px;
  background: var(--bg-raised);
  border: 1px solid var(--line);
  border-radius: var(--r-m);
}

button.big { padding: 10px 24px; font-size: 15px; }

.ready-btn {
  border-color: var(--line-strong);
  font-weight: 600;
}

.ready-btn.ready-on {
  background: color-mix(in srgb, var(--ok) 12%, #fff);
  border-color: var(--ok);
  color: var(--ok);
}

.toast {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--felt-deep);
  color: var(--paper);
  border-radius: var(--r-m);
  padding: 10px 18px;
  z-index: 100;
  font-size: 14px;
}
</style>
