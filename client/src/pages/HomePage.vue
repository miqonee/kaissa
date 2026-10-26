<script setup lang="ts">
import seoPages from '../content/seo-pages.json';
import QuickPlayPanel from '../components/QuickPlayPanel.vue';
import { useConnectionStore } from '../stores/connection';
import { trackGoal } from '../utils/analytics';
import { lobbyCapacity, GAME_MODES, modeLabel as sharedModeLabel } from 'shared';
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import type { LobbySummary, LiveGameInfo, GameMode, TimeControl, TeamMode } from 'shared';
import { getBotPersonality, getBotTooltip, timeControlLabel } from 'shared';
import { getSocket, onSocketResync } from '../api/socket';
import { api } from '../api/rest';
import { useAuthStore } from '../stores/auth';
import { useI18n } from '../stores/i18n';
import ChessBoard from '../components/ChessBoard.vue';
import CreateLobbyModal from '../components/CreateLobbyModal.vue';
import AppIcon from '../components/AppIcon.vue';
import BotHoverCard from '../components/BotHoverCard.vue';
import { usePageSeo } from '../composables/useSeo';

const i18n = useI18n();
const connection = useConnectionStore();
const liveLoaded = ref(false);

usePageSeo({
  title: computed(() => seoPages['/'][i18n.locale].title),
  description: computed(() => seoPages['/'][i18n.locale].description),
  keywords: [
    'шахматы на двоих',
    'шахматы на двоих онлайн',
    'играть в шахматы на двоих',
    'шахматы 2 на 2',
    'командные шахматы',
    'шахматы 2х2',
    'багхаус',
    'шведские шахматы',
    'team chess',
    'bughouse chess',
    'kaissa',
  ],
  canonical: '/',
});

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
const lobbies = ref<LobbySummary[]>([]);
const liveGames = ref<LiveGameInfo[]>([]);
const loadingLobbies = ref(true);
const lobbyError = ref('');
const quickMode = ref<GameMode>('team');

const autoLobbies = computed(() => lobbies.value.filter((l) => l.isAuto).sort((a, b) => a.mode.localeCompare(b.mode)));
const userLobbies = computed(() => lobbies.value.filter(l => !l.isAuto));
const humanCount = (lobby: LobbySummary) => lobby.players.filter(p => !p.isBot).length;

const sortedLiveGames = computed(() => {
  return liveGames.value.slice().sort((a, b) => {
    // 1. Приоритет партиям с живыми людьми
    const aHumans = a.players.filter((p) => !p.isBot).length;
    const bHumans = b.players.filter((p) => !p.isBot).length;
    if (aHumans !== bHumans) return bHumans - aHumans;

    // 2. Вторичная сортировка: по среднему рейтингу игроков
    const avgA = a.players.length ? a.players.reduce((s, p) => s + p.rating, 0) / a.players.length : 0;
    const avgB = b.players.length ? b.players.reduce((s, p) => s + p.rating, 0) / b.players.length : 0;
    return avgB - avgA;
  });
});

const showCreateModal = ref(false);
const createBusy = ref(false);
const createError = ref('');

const joinCode = ref('');
const joinError = ref('');
const joinBusy = ref(false);

let socket = getSocket();

async function loadLobbies() {
  loadingLobbies.value = true; lobbyError.value = '';
  try {
    const res = await api.get<{ lobbies: LobbySummary[] }>('/api/lobbies');
    if (res.lobbies) lobbies.value = res.lobbies;
  } catch { lobbyError.value = i18n.locale === 'en' ? 'Could not load tables. Check your connection.' : 'Не удалось загрузить столы. Проверьте соединение.'; } finally {
    loadingLobbies.value = false;
  }
}
function subscribeLive() {
  // Реконнект сокета теряет комнаты live/lobby-list — подписаться заново
  offResync = onSocketResync(() => {
    socket.emit('live:subscribe');
    socket.emit('lobby-list:subscribe');
  });
  socket.on('lobby:list:update', (list) => { lobbies.value = list; lobbyError.value = ''; });
  socket.on('live:snapshot', (games) => { liveGames.value = games; liveLoaded.value = true; });
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
  socket.emit('live:subscribe');
  socket.emit('lobby-list:subscribe');
}
onMounted(async () => { subscribeLive(); await loadLobbies(); handleCtaAction(route.query.action); });

let offResync: (() => void) | null = null;

function unsubscribeLive() {
  offResync?.();
  offResync = null;
  socket.off('lobby:list:update');
  socket.off('live:snapshot');
  socket.off('live:new');
  socket.off('live:update');
  socket.off('live:end');
  socket.off('user:notif');
}
onBeforeUnmount(unsubscribeLive);
function refreshSocket() { if (socket !== getSocket()) { unsubscribeLive(); socket = getSocket(); subscribeLive(); } }

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

async function openCreateModal(): Promise<void> {
  try { await auth.ensureGuest(); refreshSocket(); showCreateModal.value = true; }
  catch(e) { showToast(e instanceof Error ? e.message : 'Не удалось войти'); }
}

async function handleCreate(payload: { name: string; mode: GameMode; timeControl: TimeControl; private: boolean; teamMode?: TeamMode }) {
  createError.value = '';
  createBusy.value = true;
  try {
    await auth.ensureGuest(); refreshSocket();
    const res = await api.post<{ lobby: LobbySummary; code: string }>('/api/lobbies', payload);
    showCreateModal.value = false;
    await router.push(`/lobby/${res.lobby.id}`);
  } catch (e: any) {
    createError.value = e.message || 'Ошибка создания лобби';
  } finally {
    createBusy.value = false;
  }
}

async function joinByCode(): Promise<void> {
  const code = joinCode.value.trim().toUpperCase();
  if (!code || joinBusy.value) return;
  joinBusy.value = true; joinError.value = '';
  try { await auth.ensureGuest(); refreshSocket(); await router.push(`/lobby/${encodeURIComponent(code)}`); }
  catch(e) { joinError.value = e instanceof Error ? e.message : 'Не удалось войти'; }
  finally { joinBusy.value = false; }
}
async function enterLobby(l: LobbySummary): Promise<void> {
  if (joinBusy.value) return;
  joinBusy.value = true;
  try { await auth.ensureGuest(); refreshSocket(); await router.push(`/lobby/${l.id}`); }
  catch(e) { showToast(e instanceof Error ? e.message : 'Не удалось войти'); }
  finally { joinBusy.value = false; }
}

function playQuick(lobby: LobbySummary) { trackGoal('quick_play_clicked', { mode: lobby.mode }); void enterLobby(lobby); }

function handleCtaAction(action: unknown): void {
  if (action === 'quick') {
    quickMode.value = GAME_MODES.includes(route.query.mode as GameMode) ? route.query.mode as GameMode : 'team';
    const target = autoLobbies.value.find(l => l.mode === quickMode.value);
    if (target) {
      enterLobby(target);
    } else if (!lobbyError.value) {
      openCreateModal();
    }
  } else if (action === 'lobbies') {
    setTimeout(() => {
      document.getElementById('lobbies-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 150);
  } else if (action === 'create') {
    openCreateModal();
  }
}

watch(
  () => route.query.action,
  (act) => {
    if (act) handleCtaAction(act);
  },
);

function modeLabel(m: GameMode): string { return sharedModeLabel(m, i18n.locale); }

function teamAvgRating(players: { team: number; rating: number }[], team: number): number {
  const tp = players.filter((p) => p.team === team);
  if (!tp.length) return 1200;
  return Math.round(tp.reduce((s, p) => s + p.rating, 0) / tp.length);
}

function teamPlayers(g: LiveGameInfo, team: number): LiveGameInfo['players'] {
  return g.players.filter((p) => p.team === team);
}

function livePlayerLabel(p: LiveGameInfo['players'][number]): string {
  if (!p.isBot) return p.username;
  const perso = getBotPersonality(p.username);
  if (!perso) return i18n.locale === 'en' ? 'Bot' : 'Бот';
  return (i18n.locale === 'en' && perso.badgeEn) || perso.badge;
}

function botDisplayName(p: LiveGameInfo['players'][number]): string {
  if (!p.isBot) return p.username;
  const perso = getBotPersonality(p.username);
  if (!perso) return i18n.locale === 'en' ? 'Bot' : 'Бот';
  const name = (i18n.locale === 'en' && perso.nameEn) || perso.name;
  const parts = name.split(' ');
  return parts.length > 1 ? parts[parts.length - 1] : name;
}

function livePlayerTitle(p: LiveGameInfo['players'][number]): string {
  if (!p.isBot) return `${p.username} · ${p.rating}`;
  return getBotTooltip(p.username, p.rating, i18n.locale);
}

// Краткая сводка игроков лобби: боты — бейджем, люди — ником.
function lobbyRosterLabel(l: LobbySummary): string {
  return l.players
    .map((p) => {
      if (!p.isBot) return p.username;
      const perso = getBotPersonality(p.username);
      if (!perso) return i18n.locale === 'en' ? 'Bot' : 'Бот';
      return (i18n.locale === 'en' && perso.badgeEn) || perso.badge;
    })
    .join(', ');
}

function lobbyRosterTitle(l: LobbySummary): string {
  return l.players
    .map((p) => (p.isBot ? getBotTooltip(p.username, p.rating, i18n.locale) : `${p.username} · ${p.rating}`))
    .join('\n');
}
</script>

<template>
  <div class="home">
    <!-- Верхний баннер с быстрыми действиями -->
    <section class="home-banner panel" :aria-label="i18n.t.home.quickStartChip">
      <div class="banner-intro">
        <h1>{{ seoPages['/'][i18n.locale].heading }}</h1>
        <p class="dim">{{ i18n.locale === 'en' ? '2v2, Bughouse and Crazyhouse with friends or bots. Start without registering.' : '2×2, Багхаус и Crazyhouse с друзьями или ботами. Начать можно без регистрации.' }}</p>
      </div>

    </section>

    <QuickPlayPanel v-model="quickMode" :lobby="autoLobbies.find(l => l.mode === quickMode)" :busy="joinBusy" :loading="loadingLobbies" :error="lobbyError" :guest="!auth.user || auth.user.isGuest" @play="playQuick" @retry="loadLobbies" />

    <section class="panel invite-panel" :aria-label="i18n.locale === 'en' ? 'Play with friends' : 'Игра с друзьями'">
      <h2>{{ i18n.locale === 'en' ? 'Playing with friends?' : 'Собираетесь с друзьями?' }}</h2>
      <div class="banner-actions">
        <button class="ghost banner-create-btn" @click="openCreateModal">
          <AppIcon name="plus" :size="18" :stroke-width="2.4" />
          {{ i18n.t.home.createTable }}
        </button>

        <form class="quick-join" @submit.prevent="joinByCode">
          <input
            v-model="joinCode"
            :placeholder="i18n.t.home.tableCodePlaceholder"
            maxlength="6"
            class="mono join-input"
            :aria-label="i18n.t.home.tableCodePlaceholder"
            @input="joinError = ''"
          />
          <button type="submit" class="brass join-btn" :disabled="!joinCode.trim() || joinBusy">
            {{ i18n.t.home.joinTable }}
          </button>
        </form>
      </div>
      <p v-if="joinError" class="error-text banner-error" role="alert">{{ joinError }}</p>
    </section>

    <!-- Основная сетка -->
    <div class="home-grid">
      <section class="lobbies-col" id="lobbies-section" aria-labelledby="open-lobbies-heading">
        <div class="panel">
          <div class="panel-head">
            <h2 id="open-lobbies-heading">{{ i18n.t.home.openTablesHeading }}</h2>
            <span class="hint">{{ userLobbies.length }} {{ i18n.t.home.tablesCount }}</span>
          </div>

          <div v-if="lobbyError" class="empty" role="alert"><p>{{ lobbyError }}</p><button @click="loadLobbies">{{ i18n.locale === 'en' ? 'Try again' : 'Повторить' }}</button></div>
          <div v-else-if="loadingLobbies" class="empty dim" style="padding: 32px 16px;">
            {{ i18n.t.home.loadingTables }}
          </div>

          <div v-else-if="userLobbies.length" class="panel-body lobby-rows">
            <!-- Открытые пользовательские столы -->
            <article
              v-for="l in userLobbies"
              :key="l.id"
              class="lobby-card compact-card"

            >
              <div class="lobby-card-main">
                <div class="lobby-title-row">
                  <span class="lobby-name">{{ l.name }}</span>
                  <span class="badge mono">{{ timeControlLabel(l.timeControl) }}</span>
                  <span class="badge">{{ modeLabel(l.mode) }}</span>
                </div>
                <div class="lobby-players-summary dim" :title="lobbyRosterTitle(l)">
                  {{ lobbyRosterLabel(l) }}
                </div>
              </div>

              <div class="lobby-card-meta">
                <span class="seats-indicator" :title="`${l.players.length}/${lobbyCapacity(l.mode)}`">
                  <span
                    v-for="s in lobbyCapacity(l.mode)"
                    :key="s"
                    class="seat-pip"
                    :class="{ filled: s <= l.players.length }"
                  ></span>
                  <span class="seats mono">{{ l.players.length }}/{{ lobbyCapacity(l.mode) }}</span>
                </span>
                <button class="primary small" @click.stop="enterLobby(l)">{{ i18n.locale === 'en' ? 'Join' : 'Войти' }}</button>
              </div>
            </article>
          </div>

          <div v-else class="empty">
            <p>{{ i18n.locale === 'en' ? 'No public tables yet. Create one to invite your friends.' : 'Публичных столов пока нет. Создайте свой и пригласите друзей.' }}</p>
            <button class="primary" @click="openCreateModal">{{ i18n.locale === 'en' ? 'Create a table' : 'Создать стол для друзей' }}</button>
          </div>
        </div>
      </section>
      <!-- Текущие live-партии (Lichess TV style) -->
      <section class="live-col" aria-labelledby="live-games-heading">
        <div class="panel">
          <div class="panel-head">
            <h2 id="live-games-heading">{{ i18n.t.home.liveHeading }}</h2>
            <span class="badge on" v-if="sortedLiveGames.length">{{ sortedLiveGames.length }} {{ i18n.t.home.liveCount }}</span>
            <span class="hint" v-else>{{ !liveLoaded ? (i18n.locale === 'en' ? 'Connecting…' : 'Подключаемся…') : i18n.t.home.noLiveGames }}</span>
          </div>

          <div
            v-if="sortedLiveGames.length"
            class="panel-body live-list"
            :class="{
              'single-game': sortedLiveGames.length === 1,
              'multi-games': sortedLiveGames.length >= 2 && sortedLiveGames.length <= 3,
              'grid-games': sortedLiveGames.length >= 4,
            }"
          >
            <article
              v-for="g in sortedLiveGames"
              :key="g.gameId"
              class="live-game"
              role="button"
              tabindex="0"
              :aria-label="`${i18n.t.home.spectateHint} ${modeLabel(g.mode)}`"
              @click="router.push(`/game/${g.gameId}`)"
              @keydown.enter.space.prevent="router.push(`/game/${g.gameId}`)"
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
                <div class="live-row">
                  <span class="badge mode-badge">{{ modeLabel(g.mode) }}</span>
                  <div class="players-line">
                    <span class="team t1">
                      <template v-for="(p, pIdx) in teamPlayers(g, 1)" :key="p.username">
                        <span v-if="pIdx > 0" class="team-sep">/</span>
                        <BotHoverCard v-if="p.isBot" :username="p.username" :rating="p.rating">
                          <span class="live-player is-bot">{{ botDisplayName(p) }}</span>
                        </BotHoverCard>
                        <span v-else class="live-player">{{ p.username }}</span>
                      </template>
                      <small class="mono team-elo">({{ teamAvgRating(g.players, 1) }})</small>
                    </span>
                    <span class="vs">vs</span>
                    <span class="team t2">
                      <template v-for="(p, pIdx) in teamPlayers(g, 2)" :key="p.username">
                        <span v-if="pIdx > 0" class="team-sep">/</span>
                        <BotHoverCard v-if="p.isBot" :username="p.username" :rating="p.rating">
                          <span class="live-player is-bot">{{ botDisplayName(p) }}</span>
                        </BotHoverCard>
                        <span v-else class="live-player">{{ p.username }}</span>
                      </template>
                      <small class="mono team-elo">({{ teamAvgRating(g.players, 2) }})</small>
                    </span>
                  </div>
                  <span class="spectate-hint" :title="i18n.t.home.spectateHint">
                    <AppIcon name="eye" :size="15" />
                  </span>
                </div>
              </div>
            </article>
          </div>

          <div v-else class="empty" role="status">
            <p>{{ connection.state !== 'connected' ? (i18n.locale === 'en' ? 'Reconnecting to live games…' : 'Восстанавливаем трансляцию…') : !liveLoaded ? (i18n.locale === 'en' ? 'Loading live games…' : 'Загружаем текущие партии…') : (i18n.locale === 'en' ? 'No games are being played right now.' : 'Сейчас партий нет.') }}</p>
            <p class="hint">{{ i18n.locale === 'en' ? 'Start a quick game above or return to watch games later.' : 'Начните быструю игру выше или вернитесь к просмотру позже.' }}</p>
          </div>
        </div>
      </section>

      <!-- Открытые столы -->

    </div>

    <section v-if="!auth.user || auth.user.isGuest" class="panel home-guide" aria-labelledby="home-guide-title">
      <h2 id="home-guide-title">{{ i18n.locale === 'en' ? 'Find your way to play' : 'Выберите свой способ играть' }}</h2>
      <div class="guide-grid"><article v-for="section in seoPages['/'][i18n.locale].sections" :key="section.heading"><h3>{{ section.heading }}</h3><p v-for="paragraph in section.paragraphs" :key="paragraph">{{ paragraph }}</p></article></div>
      <nav :aria-label="i18n.locale === 'en' ? 'Learn the rules' : 'Изучить правила'"><router-link to="/rules/duo">{{ i18n.locale === 'en' ? '2v2 rules' : 'Правила 2×2' }}</router-link><router-link to="/rules/bughouse">{{ i18n.locale === 'en' ? 'Bughouse rules' : 'Правила багхауса' }}</router-link><router-link to="/rules/crazyhouse">{{ i18n.locale === 'en' ? 'Crazyhouse rules' : 'Правила Crazyhouse' }}</router-link></nav>
    </section>

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
.invite-panel {display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;padding:16px 22px;}.invite-panel h2 {font-size:17px;}.invite-panel .banner-actions {flex-wrap:wrap;}
.home-guide {padding:22px;}.home-guide h2 {font-size:22px;margin-bottom:18px;}.guide-grid {display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:24px;}.guide-grid h3 {margin-bottom:10px;}.guide-grid p {font-size:14px;color:var(--ink-2);line-height:1.65;}.home-guide nav {display:flex;flex-wrap:wrap;gap:18px;margin-top:16px;}.home-guide a {text-decoration:underline;text-underline-offset:3px;}
.quick-help { margin:0 0 10px; color:var(--ink-2); font-size:14px; }
.home {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.home-banner {
  padding: 22px 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  background: linear-gradient(135deg, var(--surface) 0%, color-mix(in srgb, var(--felt) 12%, var(--surface)) 100%);
  border-color: color-mix(in srgb, var(--accent-2) 35%, var(--line));
  min-height: 90px;
  box-sizing: border-box;
}

.banner-intro {
  flex: 1 1 500px;
  min-width: 0;
  max-width: 680px;
}

.banner-intro h1 {
  font-size: 24px;
  line-height: 1.25;
  margin-bottom: 4px;
}

.banner-intro p.dim {
  font-size: 13.5px;
  line-height: 1.45;
  margin: 0;
}

.banner-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 0 0 auto;
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
  align-items: start;
}

/* Колонки сетки */
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
  min-height: auto;
  contain: layout style;
}

@media (max-width: 980px) {
  .home-grid {
    grid-template-columns: 1fr;
  }
}

/* Live-партии */
.live-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.live-list.single-game .live-boards {
  width: 100%;
  max-width: 100%;
  margin: 0;
}

.live-list.multi-games {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
}

.live-list.grid-games {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

@media (max-width: 650px) {
  .live-list.grid-games {
    grid-template-columns: 1fr;
  }
}

.live-game {
  cursor: pointer;
  border: 1px solid var(--line);
  border-radius: var(--r-m);
  padding: 10px 12px;
  background: var(--surface-inset);
  transition: all 0.15s;
  touch-action: manipulation;
}

.live-game:hover {
  border-color: var(--accent-2);
  background: var(--surface-2);
  transform: translateY(-1px);
}

.live-boards {
  display: grid;
  gap: 8px;
  width: 100%;
  aspect-ratio: 1;
}

.live-boards.two {
  grid-template-columns: 1fr 1fr;
  aspect-ratio: 2 / 1;
}

.live-meta {
  margin-top: 8px;
  width: 100%;
  overflow: hidden;
}

.live-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
  font-size: 12px;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
}

.mode-badge {
  font-size: 11px;
  padding: 1px 6px;
  flex-shrink: 0;
  line-height: 1.3;
}

.players-line {
  font-size: 12px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
}

.players-line .vs {
  color: var(--ink-3);
  font-size: 11px;
  font-style: italic;
  margin: 0 2px;
  flex-shrink: 0;
}

.team {
  color: var(--ink);
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.live-player {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 90px;
}

.live-player.is-bot {
  color: var(--accent-2);
  font-weight: 600;
  cursor: help;
}

.team-sep {
  margin: 0 4px;
  color: var(--ink-3);
  font-weight: 400;
  font-size: 11px;
}

.team-elo {
  color: var(--ink-3);
  margin-left: 2px;
  font-size: 11px;
  flex-shrink: 0;
}

.spectate-hint {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border-radius: var(--r-xs);
  transition: color var(--t-fast), background var(--t-fast);
}

.live-game:hover .spectate-hint {
  color: var(--accent-2);
  background: color-mix(in srgb, var(--accent) 15%, transparent);
}

/* Карточки столов */
.lobby-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  max-height: 520px;
  overflow-y: auto;
}

.lobby-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 9px 13px;
  border: 1px solid var(--line);
  border-radius: var(--r-m);
  background: var(--surface-inset);
  cursor: pointer;
  transition: all 0.15s;
  touch-action: manipulation;
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

.single-line-card {
  padding: 8px 12px;
}

.single-line-main {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}

.badges-row {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  min-width: 0;
  white-space: nowrap;
}

.live-player + .live-player::before {
  content: '/';
  margin: 0 5px;
  color: var(--ink-3);
  font-weight: 400;
}

.live-player.is-bot {
  color: var(--accent-2);
  font-weight: 600;
  cursor: help;
}

.auto-hint-chip {
  background: color-mix(in srgb, var(--surface-inset) 85%, var(--line));
  color: var(--ink-2);
  border: 1px solid var(--line);
  font-size: 11px;
  font-weight: 500;
  border-radius: 999px;
  padding: 2px 8px;
  display: inline-flex;
  align-items: center;
}

.auto-lobby-desc {
  font-size: 11.5px;
  color: var(--ink-3);
  margin-top: 1px;
}

.lobby-players-summary {
  font-size: 11.5px;
  color: var(--ink-3);
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 240px;
}

.bot-dot {
  background: var(--ink-3);
  box-shadow: none;
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

.seat-pip.bot {
  background: var(--ink-3);
  box-shadow: none;
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
@media (max-width: 768px) {
  .banner-intro { flex: 0 1 auto; }

  .home-banner {
    flex-direction: column;
    align-items: stretch;
    padding: 18px 16px;
    gap: 16px;
    min-height: auto;
  }

  .banner-intro h1 {
    font-size: 21px;
  }

  .banner-actions {
    width: 100%;
    flex-wrap: wrap;
  }
}

@media (max-width: 560px) {
  .home-banner {
    padding: 16px 14px;
    gap: 14px;
    min-height: auto;
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

  .lobby-card.single-line-card {
    flex-direction: column;
  }

  .lobby-card.single-line-card .single-line-main {
    flex-wrap: wrap;
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
