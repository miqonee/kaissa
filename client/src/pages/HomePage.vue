<script setup lang="ts">
import seoPages from '../content/seo-pages.json';
import HomeLiveGames from '../components/HomeLiveGames.vue';
import QuickPlayPanel from '../components/QuickPlayPanel.vue';
import { trackGoal } from '../utils/analytics';
import { lobbyCapacity, GAME_MODES, modeLabel as sharedModeLabel } from 'shared';
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import type { LobbySummary, GameMode, TimeControl, TeamMode } from 'shared';
import { getBotPersonality, getBotTooltip, timeControlLabel } from 'shared';
import { useHomeFeed } from '../composables/useHomeFeed';
import { api } from '../api/rest';
import { useAuthStore } from '../stores/auth';
import { useI18n } from '../stores/i18n';
import CreateLobbyModal from '../components/CreateLobbyModal.vue';
import AppIcon from '../components/AppIcon.vue';
import { usePageSeo } from '../composables/useSeo';

const i18n = useI18n();

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
const quickMode = ref<GameMode>('team');

const showCreateModal = ref(false);
const createBusy = ref(false);
const createError = ref('');

const joinCode = ref('');
const joinError = ref('');
const joinBusy = ref(false);

const { lobbies, liveGames, liveLoaded, loadingLobbies, lobbyError, loadLobbies, refreshSocket } = useHomeFeed((lobbyId, name) => {
  const label = name ?? (i18n.locale === 'en' ? 'table' : 'лобби');
  const text = i18n.locale === 'en' ? `Invitation to “${label}”` : `Приглашение в стол «${label}»`;
  notifyBrowser(text);
  showToast(text, () => { if (lobbyId) router.push(`/lobby/${lobbyId}`); });
});
const autoLobbies = computed(() => lobbies.value.filter((l) => l.isAuto).sort((a, b) => a.mode.localeCompare(b.mode)));
const userLobbies = computed(() => lobbies.value.filter(l => !l.isAuto));

onMounted(async () => { await loadLobbies(); handleCtaAction(route.query.action); });
onBeforeUnmount(() => clearTimeout(toastTimer));

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
    <!-- Заголовок страницы и общий блок игровых действий -->
    <section class="home-banner" :aria-label="i18n.t.home.quickStartChip">
      <div class="banner-intro">
        <h1>{{ seoPages['/'][i18n.locale].heading }}</h1>
        <p class="dim">{{ i18n.locale === 'en' ? '2v2, Bughouse and Crazyhouse with friends or bots. Start without registering.' : '2×2, Багхаус и Crazyhouse с друзьями или ботами. Начать можно без регистрации.' }}</p>
      </div>
    </section>

    <div class="panel play-panel">
      <QuickPlayPanel v-model="quickMode" :lobby="autoLobbies.find(l => l.mode === quickMode)" :busy="joinBusy" :loading="loadingLobbies" :error="lobbyError" @play="playQuick" @retry="loadLobbies" />

    </div>

    <!-- Основная сетка -->
    <div class="home-grid">
      <section class="lobbies-col" id="lobbies-section" aria-labelledby="open-lobbies-heading">
        <div class="panel">
          <div class="panel-head open-tables-head">
            <div class="open-tables-title">
              <h2 id="open-lobbies-heading">{{ i18n.t.home.openTablesHeading }}</h2>
              <span class="hint">{{ userLobbies.length }} {{ i18n.t.home.tablesCount }}</span>
            </div>
            <form class="quick-join" @submit.prevent="joinByCode">
              <input
                v-model="joinCode"
                :placeholder="i18n.t.home.tableCodePlaceholder"
                maxlength="6"
                class="mono join-input"
                :aria-label="i18n.t.home.tableCodePlaceholder"
                @input="joinError = ''"
              />
              <button type="submit" class="join-btn" :disabled="!joinCode.trim() || joinBusy">
                {{ i18n.t.home.joinTable }}
              </button>
            </form>
            <p v-if="joinError" class="error-text banner-error" role="alert">{{ joinError }}</p>
          </div>

          <div v-if="lobbyError" class="empty" role="alert"><p>{{ lobbyError }}</p></div>
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
          </div>
          <div class="table-create-actions">
            <button class="primary" @click="openCreateModal">
              <AppIcon name="plus" :size="18" :stroke-width="2.4" />
              {{ i18n.t.home.createTable }}
            </button>
          </div>
        </div>
      </section>
      <!-- Текущие live-партии (Lichess TV style) -->
      <HomeLiveGames :games="liveGames" :live-loaded="liveLoaded" />

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
.play-panel { box-shadow: none; }
.home-guide {padding:22px;}.home-guide h2 {font-size:22px;margin-bottom:18px;}.guide-grid {display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:24px;}.guide-grid h3 {margin-bottom:10px;}.guide-grid p {font-size:14px;color:var(--ink-2);line-height:1.65;}.home-guide nav {display:flex;flex-wrap:wrap;gap:18px;margin-top:16px;}.home-guide a {text-decoration:underline;text-underline-offset:3px;}
.home {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.home-banner { padding: 4px 2px; }

.banner-intro {
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

.table-create-actions {
  display: flex;
  justify-content: center;
  padding: 16px;
}

.quick-join {
  display: flex;
  align-items: center;
  gap: 6px;
}

.join-input {
  height: var(--control-size);
  width: 140px;
  padding: 0 12px;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 600;
  text-align: center;
  border-radius: var(--r-s);
  box-sizing: border-box;
}

.join-btn {
  height: var(--control-size);
  padding: 0 12px;
  font-size: 13px;
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
  gap: 20px;
  align-items: start;
}
.live-col,
.lobbies-col {
  display: flex;
  min-width: 0;
}

.live-col :deep(> .panel),
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

.lobby-players-summary {
  font-size: 11.5px;
  color: var(--ink-3);
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 240px;
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

.seats {
  font-size: 12.5px;
  color: var(--ink-2);
  font-weight: 700;
}
@media (max-width: 768px) {
  .banner-intro h1 {
    font-size: 21px;
  }

}

@media (max-width: 560px) {
  .banner-intro h1 {
    font-size: 20px;
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
}
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
[data-theme='light'] .play-panel { background: linear-gradient(120deg, var(--surface), color-mix(in srgb, var(--felt) 3%, var(--surface))); }
.open-tables-title { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; }
.lobby-card-main { min-width: 0; }
.lobby-title-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.lobby-name { overflow-wrap: anywhere; }
@media (max-width: 560px) { .open-tables-head .quick-join { flex: 1 1 100%; } .join-input { min-width: 0; } }
</style>
