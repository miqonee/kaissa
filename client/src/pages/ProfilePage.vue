<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import {
  GAME_MODES,
  emptyModeRating,
  PROVISIONAL_GAMES,
  modeLabel,
  type GameMode,
  type ProfilePayload,
} from "shared";
import { api } from "../api/rest";
import { useAuthStore } from "../stores/auth";
import { useI18n } from "../stores/i18n";
import { usePageSeo } from "../composables/useSeo";
import { isMuted, toggleSound } from "../audio/sounds";
import ModeTabs from "../components/ModeTabs.vue";
import MatchCard from "../components/MatchCard.vue";
import GameReplayModal from "../components/GameReplayModal.vue";
const route = useRoute();
const auth = useAuthStore();
const i18n = useI18n();
const en = computed(() => i18n.locale === "en");
const mode = ref<GameMode>(
  GAME_MODES.includes(route.query.mode as GameMode)
    ? (route.query.mode as GameMode)
    : "team",
);
const profile = ref<ProfilePayload | null>(null);
const error = ref("");
const loading = ref(true);
const replayId = ref<number | null>(null);
let version = 0;
const stats = computed(
  () =>
    profile.value?.user.modeRatings?.find((r) => r.mode === mode.value) ??
    emptyModeRating(mode.value),
);
const ratedGames = computed(
  () => stats.value.wins + stats.value.losses + stats.value.draws,
);
usePageSeo({
  noindex: computed(() => !!error.value || !!profile.value?.user.isGuest || !!profile.value?.user.isBot),
  description: computed(() => profile.value ? (en.value ? `Games and ratings of ${profile.value.user.username} in ${modeLabel(mode.value, 'en')}. View both teams, results and replays on Kaissa.` : `Партии и рейтинг ${profile.value.user.username} в режиме ${modeLabel(mode.value)}. Составы команд, результаты и реплеи в клубе Каисса.`) : undefined),
  title: computed(
    () =>
      `${route.params.username} — ${en.value ? "player profile" : "профиль игрока"} | Каисса`,
  ),
  canonical: computed(() => `/players/${route.params.username}`),
});
async function load() {
  const current = ++version;
  loading.value = true;
  error.value = "";
  try {
    const data = await api.get<ProfilePayload>(
      `/api/users/${encodeURIComponent(String(route.params.username))}?mode=${mode.value}`,
    );
    if (current === version) profile.value = data;
  } catch (e) {
    if (current === version) error.value = String(e);
  } finally {
    if (current === version) loading.value = false;
  }
}
watch(mode, load, { immediate: true });
const sparkPath = computed(() => {
  const pts = profile.value?.ratingHistory ?? [];
  const min = Math.min(...pts.map((p) => p.rating));
  const span = Math.max(1, Math.max(...pts.map((p) => p.rating)) - min);
  return pts
    .map(
      (p, i) =>
        `${i ? "L" : "M"}${((i * 560) / Math.max(1, pts.length - 1)).toFixed(1)},${(115 - ((p.rating - min) * 110) / span).toFixed(1)}`,
    )
    .join(" ");
});
</script>
<template>
  <div class="profile">
    <header class="panel profile-head">
      <h1>{{ route.params.username }}</h1>
      <span v-if="profile?.user.isGuest" class="badge">{{
        en ? "Guest" : "Гость"
      }}</span
      ><span v-if="profile?.user.isBot" class="badge">{{
        en ? "Bot" : "Бот"
      }}</span>
    </header>
    <section class="panel">
      <ModeTabs v-model="mode" />
      <div v-if="loading" class="empty" role="status">
        {{ en ? "Loading…" : "Загрузка…" }}
      </div>
      <div v-else-if="error" class="empty" role="alert">
        <p>
          {{ en ? "Could not load profile." : "Не удалось загрузить профиль." }}
        </p>
        <button @click="load">{{ en ? "Try again" : "Повторить" }}</button>
      </div>
      <div v-else-if="profile" class="panel-body profile-stats">
        <div class="rating-heading">
          <strong class="rating-number">{{
            profile.user.isGuest || profile.user.isBot ? "—" : stats.rating
          }}</strong>
          <div>
            <strong>{{ modeLabel(mode, i18n.locale) }} · Elo</strong>
            <p class="dim">
              {{
                profile.user.isGuest || profile.user.isBot
                  ? en
                    ? "Not in public rankings"
                    : "Не участвует в публичном рейтинге"
                  : ratedGames < PROVISIONAL_GAMES
                    ? en
                      ? `Preliminary · ${ratedGames}/${PROVISIONAL_GAMES} games`
                      : `Предварительный · ${ratedGames}/${PROVISIONAL_GAMES} партий`
                    : en
                      ? `${ratedGames} rated games`
                      : `${ratedGames} рейтинговых партий`
              }}
            </p>
          </div>
        </div>
        <div class="stat-groups">
          <div>
            <h2>{{ en ? "Rated games" : "Рейтинговые партии" }}</h2>
            <p>
              {{ en ? "Wins / Draws / Losses" : "Победы / Ничьи / Поражения" }}
            </p>
            <strong
              >{{ stats.wins }} / {{ stats.draws }} / {{ stats.losses }}</strong
            >
          </div>
          <div>
            <h2>
              {{
                en ? "Training · bots or guests" : "Тренировки · боты или гости"
              }}
            </h2>
            <p>
              {{ en ? "Wins / Draws / Losses" : "Победы / Ничьи / Поражения" }}
            </p>
            <strong
              >{{ stats.trainingWins }} / {{ stats.trainingDraws }} /
              {{ stats.trainingLosses }}</strong
            >
          </div>
        </div>
        <p class="dim">
          {{
            en
              ? "Mode ratings start at 1200. Earlier games retain their former common rating in the archive."
              : "Рейтинг каждого режима начинается с 1200. В прежних партиях сохранён общий рейтинг на момент игры."
          }}
          <router-link to="/leaderboard">{{
            en ? "How ratings work" : "Как считается рейтинг"
          }}</router-link>
        </p>
        <svg
          v-if="profile.ratingHistory.length >= 2"
          viewBox="0 0 560 120"
          class="spark"
          role="img"
          :aria-label="en ? 'Rating history' : 'История рейтинга'"
        >
          <title>{{ modeLabel(mode, i18n.locale) }}</title>
          <path
            :d="sparkPath"
            fill="none"
            stroke="var(--accent)"
            stroke-width="2"
          />
        </svg>
      </div>
    </section>
    <section
      v-if="auth.user?.id === profile?.user.id"
      class="panel profile-head"
    >
      <span>{{ en ? "Game sounds" : "Звуки игры" }}</span
      ><button @click="toggleSound">
        {{ isMuted ? (en ? "Enable" : "Включить") : en ? "Mute" : "Выключить" }}
      </button>
    </section>
    <section v-if="profile && !loading && !error" class="panel">
      <div class="panel-head">
        <h2>{{ en ? "Recent games" : "Последние партии" }}</h2>
        <router-link to="/history">{{
          en ? "Full archive" : "Весь архив"
        }}</router-link>
      </div>
      <div class="match-list">
        <MatchCard
          v-for="g in profile.recentGames"
          :key="g.id"
          :game="g"
          :viewer-id="auth.user?.id"
          @replay="replayId = $event"
        />
        <p v-if="!profile.recentGames.length" class="empty">
          {{
            en ? "No games in this mode yet." : "В этом режиме партий пока нет."
          }}
        </p>
      </div>
    </section>
    <GameReplayModal
      v-if="replayId !== null"
      :game-id="replayId"
      :title="`${en ? 'Game' : 'Партия'} #${replayId}`"
      @close="replayId = null"
    />
  </div>
</template>
<style scoped>
.profile {
  display: grid;
  gap: 16px;
}
.profile-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  flex-wrap: wrap;
}
.profile-head h1 {
  overflow-wrap: anywhere;
}
.profile-stats {
  padding: 16px;
}
.rating-heading {
  display: flex;
  align-items: center;
  gap: 18px;
}
.rating-number {
  font-size: 40px;
}
.stat-groups {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin: 20px 0;
}
.stat-groups h2 {
  font-size: 16px;
}
.stat-groups p {
  font-size: 13px;
  color: var(--ink-2);
}
.stat-groups strong {
  font-size: 24px;
}
.spark {
  width: 100%;
  height: 140px;
  margin-top: 16px;
}
.match-list {
  padding: 16px;
  display: grid;
  gap: 14px;
}
</style>
