<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { ChatMessage, LobbySummary } from 'shared';
import { timeControlLabel } from 'shared';
import { getSocket, onSocketResync } from '../api/socket';
import { useAuthStore } from '../stores/auth';
import AppIcon from '../components/AppIcon.vue';

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

const toastText = ref('');
let toastTimer: number | undefined;

function showNotification(text: string) {
  toastText.value = text;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toastText.value = ''), 2500);
}

function scrollChat(): void {
  setTimeout(() => {
    if (chatBox.value) chatBox.value.scrollTop = chatBox.value.scrollHeight;
  }, 30);
}

function joinLobby(): void {
  socket.emit('lobby:join', lobbyId.value, (ack) => {
    if (ack.ok && ack.data) {
      lobby.value = ack.data.lobby;
    } else if (!lobby.value) {
      error.value = ack.error ?? 'Не удалось войти в лобби';
    }
  });
}

let offResync: (() => void) | null = null;
let gameStarting = false;

onMounted(() => {
  joinLobby();
  // Реконнект сокета теряет комнату лобби — войти заново
  offResync = onSocketResync(joinLobby);

  socket.on('lobby:state', (state) => {
    if (state.id !== lobbyId.value) return;
    lobby.value = state;
  });
  socket.on('lobby:chat', (msg) => {
    chat.value.push(msg);
    scrollChat();
  });
  socket.on('lobby:started', ({ gameId }) => {
    gameStarting = true;
    router.push(`/game/${gameId}`);
  });
  socket.on('lobby:closed', (reason) => {
    error.value = reason;
  });
});

onBeforeUnmount(() => {
  offResync?.();
  offResync = null;
  if (!gameStarting) {
    socket.emit('lobby:leave');
  }
  socket.off('lobby:state');
  socket.off('lobby:chat');
  socket.off('lobby:started');
  socket.off('lobby:closed');
});

function setReady(): void {
  socket.emit('lobby:ready', !iAmReady.value);
}

function kick(userId: number): void {
  if (confirm('Исключить этого игрока из стола?')) {
    socket.emit('lobby:kick', userId);
  }
}

function summon(): void {
  if ('Notification' in window && Notification.permission === 'default') {
    void Notification.requestPermission();
  }
  socket.emit('lobby:summon');
  showNotification('Участникам отправлено браузерное уведомление');
}

function start(): void {
  socket.emit('lobby:start', (ack) => {
    if (!ack.ok) {
      error.value = ack.error ?? 'Не удалось начать';
      setTimeout(() => (error.value = ''), 3500);
      return;
    }
    if (ack.data?.gameId) {
      gameStarting = true;
      router.push(`/game/${ack.data.gameId}`);
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
  showNotification('Прямая ссылка скопирована');
}

function copyCode(): void {
  if (!lobby.value?.code) return;
  void navigator.clipboard.writeText(lobby.value.code);
  showNotification(`Код ${lobby.value.code} скопирован`);
}

function modeLabel(m: string): string {
  return m === 'bughouse' ? 'Багхаус (2 доски)' : '2×2 (одна доска)';
}
</script>

<template>
  <div v-if="error && !lobby" class="empty">
    <p>{{ error }}</p>
    <router-link to="/" class="primary">На главную</router-link>
  </div>

  <div v-else-if="lobby" class="lobby-page">
    <!-- Блок заголовка стола с КРУПНЫМ кодом для подключения -->
    <div class="lobby-hero panel">
      <div class="hero-left">
        <div class="hero-title-row">
          <h1>{{ lobby.name }}</h1>
          <span class="badge">{{ modeLabel(lobby.mode) }}</span>
          <span class="badge mono">{{ timeControlLabel(lobby.timeControl) }}</span>
        </div>
        <p class="dim hero-desc">
          Соберите 4 игроков за столом. При старте команды распределятся по рейтингу поровну (1+4 против 2+3).
        </p>
      </div>

      <!-- Крупный код для входа -->
      <div class="code-box">
        <span class="code-label">Код стола для входа:</span>
        <div class="code-display" @click="copyCode" title="Кликните, чтобы скопировать">
          <span class="code-text mono">{{ lobby.code || '------' }}</span>
          <span class="copy-icon"><AppIcon name="copy" :size="16" /></span>
        </div>
        <div class="code-actions">
          <button class="small ghost" @click="copyLink">
            <AppIcon name="copy" :size="14" /> Скопировать ссылку
          </button>
        </div>
      </div>
    </div>

    <!-- Основная раскладка: Игроки слева + Чат справа -->
    <div class="lobby-layout">
      <!-- 4 слота игроков -->
      <section class="panel players-panel">
        <div class="panel-head">
          <h2>Игроки за столом</h2>
          <span class="hint">{{ lobby.players.length }} из 4 за столом</span>
        </div>

        <div class="panel-body">
          <div class="slots">
            <div
              v-for="(p, i) in lobby.players"
              :key="p.userId"
              class="slot-card"
              :class="{ 'is-ready': p.ready, 'is-me': p.userId === me?.id }"
            >
              <div class="slot-idx mono">{{ i + 1 }}</div>
              <div class="slot-avatar">
                <span class="dot" :class="{ on: p.online }" :title="p.online ? 'В сети' : 'Не в сети'"></span>
              </div>
              <div class="slot-info">
                <div class="slot-name-row">
                  <span class="slot-name">{{ p.username }}</span>
                  <span v-if="p.host" class="host-crown" title="Создатель стола">
                    <AppIcon name="crown" :size="12" /> Хост
                  </span>
                </div>
                <span class="slot-rating mono dim">Рейтинг: {{ p.rating }}</span>
              </div>

              <div class="slot-status">
                <span class="ready-badge" :class="p.ready ? 'ready' : 'waiting'">
                  <AppIcon v-if="p.ready" name="check" :size="12" /><span>{{ p.ready ? 'Готов' : 'Ждём…' }}</span>
                </span>
                <button
                  v-if="isHost && p.userId !== me?.id"
                  class="small danger icon-only"
                  title="Исключить игрока"
                  :aria-label="`Исключить ${p.username}`"
                  @click="kick(p.userId)"
                >
                  <AppIcon name="close" :size="14" />
                </button>
              </div>
            </div>

            <!-- Пустые слоты -->
            <div
              v-for="i in 4 - lobby.players.length"
              :key="'empty' + i"
              class="slot-card empty-slot"
            >
              <div class="slot-idx mono">{{ lobby.players.length + i }}</div>
              <div class="slot-info">
                <span class="slot-name dim">Ожидание игрока…</span>
              </div>
            </div>
          </div>

          <!-- Нижняя панель: только когда есть кого призвать -->
          <div v-if="offlinePlayers.length" class="lobby-tools">
            <button
              class="brass"
              @click="summon"
              title="Отправить браузерное уведомление офлайн-игрокам"
            >
              <AppIcon name="bell" :size="15" />
              Призвать игроков ({{ offlinePlayers.length }} не в сети)
            </button>
          </div>
        </div>
      </section>

      <!-- Чат лобби -->
      <section class="panel chat-panel">
        <div class="panel-head">
          <h3>Чат стола</h3>
          <span class="hint">{{ chat.length }} сообщений</span>
        </div>
        <div class="panel-body chat-body">
          <div ref="chatBox" class="chat-log">
            <div v-for="m in chat" :key="m.id" class="chat-msg">
              <span class="chat-user">{{ m.username }}:</span>
              <span class="chat-text">{{ m.text }}</span>
            </div>
            <div v-if="!chat.length" class="empty-chat dim">
              Сообщений пока нет. Напишите что-нибудь игрокам!
            </div>
          </div>
          <form class="chat-input-row" @submit.prevent="sendChat">
            <input v-model="chatText" placeholder="Написать в стол…" maxlength="300" />
            <button type="submit" class="primary">Отправить</button>
          </form>
        </div>
      </section>
    </div>

    <!-- Нижняя полоса управления готовностью и стартом (Lichess style) -->
    <div class="start-bar panel">
      <div class="start-info">
        <p v-if="lobby.players.length < 4" class="dim">
          Для начала матча нужно 4 игрока. Сейчас: {{ lobby.players.length }}/4.
        </p>
        <p v-else-if="!allReady" class="dim">
          Все игроки должны подтвердить готовность.
        </p>
        <p v-else class="ok-hint">
          Все готовы! Хост может запускать партию.
        </p>
      </div>

      <div class="start-btns">
        <button
          class="ready-toggle-btn"
          :class="{ active: iAmReady }"
          @click="setReady"
        >
          <AppIcon v-if="iAmReady" name="check" :size="14" />
          {{ iAmReady ? 'Я готов' : 'Нажать «Готов»' }}
        </button>

        <button
          v-if="isHost"
          class="primary big"
          :disabled="!allReady"
          @click="start"
        >
          Начать игру
        </button>
      </div>
    </div>

    <!-- Всплывающее уведомление -->
    <div v-if="toastText" class="toast">{{ toastText }}</div>
  </div>

  <div v-else class="empty">Загрузка стола…</div>
</template>

<style scoped>
.lobby-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.lobby-hero {
  padding: 22px 28px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
  border-color: color-mix(in srgb, var(--accent-2) 30%, var(--line));
}

.hero-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

.hero-title-row h1 {
  font-size: 24px;
}

.hero-desc {
  margin: 0;
  max-width: 580px;
}

/* Код лобби */
.code-box {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}
@media (max-width: 768px) {
  .code-box {
    align-items: flex-start;
  }
}

.code-label {
  font-size: 11.5px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ink-3);
  font-weight: 600;
}

.code-display {
  background: var(--surface-inset);
  border: 2px dashed var(--accent-2);
  padding: 8px 18px;
  border-radius: var(--r-m);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: all 0.15s;
}

.code-display:hover {
  background: color-mix(in srgb, var(--accent-2) 12%, var(--surface-inset));
  border-color: var(--accent);
  transform: scale(1.02);
}

.code-text {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: 0.22em;
  color: var(--accent-2);
}

.copy-icon {
  display: inline-flex;
  color: var(--ink-3);
}

.code-actions {
  display: flex;
  gap: 8px;
}

/* Сетка страницы: панели равной высоты */
.lobby-layout {
  display: grid;
  grid-template-columns: 1.35fr 1fr;
  gap: 20px;
  align-items: stretch;
}
@media (max-width: 900px) {
  .lobby-layout {
    grid-template-columns: 1fr;
  }
}

.players-panel,
.chat-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.players-panel > .panel-body,
.chat-panel > .panel-body {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* Слоты */
.slots {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.slot-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  border: 1px solid var(--line);
  border-radius: var(--r-m);
  background: var(--surface-inset);
  transition: all 0.15s;
}

.slot-card.is-ready {
  border-color: color-mix(in srgb, var(--ok) 45%, var(--line));
  background: color-mix(in srgb, var(--ok) 6%, var(--surface-inset));
}

.slot-card.is-me {
  box-shadow: inset 0 0 0 1.5px var(--accent-2);
}

.slot-idx {
  font-size: 16px;
  font-weight: 700;
  color: var(--ink-3);
  width: 20px;
}

.slot-info {
  flex: 1;
  min-width: 0;
}

.slot-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.slot-name {
  font-size: 15px;
  font-weight: 600;
}

.host-crown {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--accent);
  font-size: 11.5px;
  font-weight: 700;
  background: var(--accent-soft);
  padding: 2px 8px;
  border-radius: var(--r-xs);
}

.slot-status {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.ready-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid;
  white-space: nowrap;
  flex-shrink: 0;
  line-height: 1;
}

.ready-badge.ready {
  color: var(--ok);
  border-color: var(--ok);
  background: color-mix(in srgb, var(--ok) 12%, transparent);
}

.ready-badge.waiting {
  color: var(--ink-3);
  border-color: var(--line-2);
  background: transparent;
}

.empty-slot {
  border-style: dashed;
  background: transparent;
  opacity: 0.6;
}

.lobby-tools {
  margin-top: 16px;
  display: flex;
  gap: 10px;
}

/* Чат */
.chat-panel {
  display: flex;
  flex-direction: column;
}

.chat-body {
  flex: 1;
  height: auto;
  min-height: 320px;
  display: flex;
  flex-direction: column;
}

.chat-log {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 4px;
}

.chat-msg {
  font-size: 13.5px;
  line-height: 1.4;
  word-break: break-word;
}

.chat-user {
  font-weight: 600;
  color: var(--accent-2);
  margin-right: 6px;
}

.empty-chat {
  margin: auto;
  font-size: 13px;
}

.chat-input-row {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

/* Старт-бар */
.start-bar {
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.start-info p {
  margin: 0;
  font-size: 14px;
}

.ok-hint {
  color: var(--ok);
  font-weight: 600;
}

.start-btns {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ready-toggle-btn {
  padding: 9px 18px;
  font-size: 14px;
  font-weight: 600;
  border-color: var(--line-2);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.ready-toggle-btn.active {
  background: color-mix(in srgb, var(--ok) 16%, var(--surface-2));
  color: var(--ok);
  border-color: var(--ok);
}

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
  box-shadow: var(--shadow-l);
  z-index: 2000;
  font-size: 14px;
}
</style>
