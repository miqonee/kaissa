<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { GAME_MODES, modeLabel, type GameSummary } from "shared";
import { api } from "../api/rest";
import { useAuthStore } from "../stores/auth";
import { useI18n } from "../stores/i18n";
import { usePageSeo } from "../composables/useSeo";
import MatchCard from "../components/MatchCard.vue";
import GameReplayModal from "../components/GameReplayModal.vue";
const auth = useAuthStore();
const i18n = useI18n();
const en = computed(() => i18n.locale === "en");
usePageSeo({ canonical: '/history' });
const tab = ref(auth.user ? "mine" : "all");
const mode = ref("");
const opponents = ref("");
const result = ref("");
const kind = ref("");
const player = ref("");
const games = ref<GameSummary[]>([]);
const loading = ref(false);
const error = ref("");
const nextCursor = ref<number | null>(null);
const replayId = ref<number | null>(null);
let version = 0;
let timer: ReturnType<typeof setTimeout>;
async function load(more = false) {
  const current = ++version;
  loading.value = true;
  error.value = "";
  if (!more) {
    games.value = [];
    nextCursor.value = null;
  }
  const query = new URLSearchParams({
    mode: mode.value,
    opponents: opponents.value,
    result: result.value,
    kind: kind.value,
    player: player.value,
  });
  if (more && nextCursor.value) query.set("cursor", String(nextCursor.value));
  try {
    const res = await api.get<{
      games: GameSummary[];
      nextCursor: number | null;
    }>(`/api/games/${tab.value === "mine" ? "mine" : "archive"}?${query}`);
    if (current !== version) return;
    games.value = more ? [...games.value, ...res.games] : res.games;
    nextCursor.value = res.nextCursor;
  } catch (e) {
    if (current === version)
      error.value = e instanceof Error ? e.message : "Ошибка загрузки";
  } finally {
    if (current === version) loading.value = false;
  }
}
watch(
  [tab, mode, opponents, result, kind],
  () => {
    clearTimeout(timer);
    if (tab.value === "all" && ["win", "loss"].includes(result.value)) {
      result.value = "";
      return;
    }
    void load();
  },
  { immediate: true },
);
watch(player, () => {
  ++version;
  loading.value = true;
  clearTimeout(timer);
  timer = setTimeout(() => void load(), 300);
});
onBeforeUnmount(() => {
  ++version;
  clearTimeout(timer);
});
</script>
<template>
  <section class="panel history-panel">
    <div class="panel-head">
      <h1>{{ en ? "Match history" : "История партий" }}</h1>
    </div>
    <div class="history-controls">
      <div
        role="group"
        :aria-label="en ? 'Archive' : 'Архив'"
        class="scope-tabs"
      >
        <button
          :class="{ primary: tab === 'mine' }"
          :aria-pressed="tab === 'mine'"
          @click="tab = 'mine'"
        >
          {{ en ? "My games" : "Мои партии" }}
        </button>
        <button
          :class="{ primary: tab === 'all' }"
          :aria-pressed="tab === 'all'"
          @click="tab = 'all'"
        >
          {{ en ? "Club games" : "Партии клуба" }}
        </button>
      </div>
      <div class="filters">
        <label
          >{{ en ? "Mode" : "Режим"
          }}<select v-model="mode">
            <option value="">{{ en ? "All modes" : "Все режимы" }}</option>
            <option v-for="m in GAME_MODES" :key="m" :value="m">
              {{ modeLabel(m, i18n.locale) }}
            </option>
          </select></label
        >
        <label
          >{{ en ? "Opponents" : "Соперники"
          }}<select v-model="opponents">
            <option value="">{{ en ? "All" : "Все" }}</option>
            <option value="humans">
              {{ en ? "Humans on both teams" : "Люди в обеих командах" }}
            </option>
            <option value="bots">
              {{ en ? "Against bots" : "Против ботов" }}
            </option>
          </select></label
        >
        <label
          >{{ en ? "Result" : "Результат"
          }}<select v-model="result">
            <option value="">{{ en ? "All" : "Все" }}</option>
            <option v-if="tab === 'mine'" value="win">
              {{ en ? "Wins" : "Победы" }}
            </option>
            <option v-if="tab === 'mine'" value="loss">
              {{ en ? "Losses" : "Поражения" }}
            </option>
            <option value="draw">{{ en ? "Draws" : "Ничьи" }}</option>
            <option value="abandoned">
              {{ en ? "Abandoned" : "Не завершены" }}
            </option>
          </select></label
        >
        <label
          >{{ en ? "Rating" : "Рейтинг"
          }}<select v-model="kind">
            <option value="">{{ en ? "All games" : "Все партии" }}</option>
            <option value="rated">{{ en ? "Rated" : "Рейтинговые" }}</option>
            <option value="training">
              {{ en ? "Training" : "Тренировочные" }}
            </option>
          </select></label
        >
        <label
          >{{ en ? "Player or teammate" : "Игрок или напарник"
          }}<input
            v-model="player"
            type="search"
            maxlength="30"
            :placeholder="en ? 'Username' : 'Ник участника'"
        /></label>
      </div>
    </div>
    <div v-if="tab === 'mine' && !auth.user" class="empty">
      <p>
        {{
          en
            ? "Sign in to see your games. The club archive is available to registered players."
            : "Войдите, чтобы увидеть свои партии. Архив клуба доступен зарегистрированным игрокам."
        }}
      </p>
      <router-link
        class="button"
        :to="{ name: 'login', query: { redirect: '/history' } }"
        >{{ en ? "Sign in" : "Войти" }}</router-link
      >
    </div>
    <template v-else>
      <div v-if="error" class="empty" role="alert">
        <p>
          {{
            en
              ? "Could not load games. Check your connection."
              : "Не удалось загрузить партии. Проверьте соединение."
          }}
        </p>
        <button @click="load()">{{ en ? "Try again" : "Повторить" }}</button>
      </div>
      <div class="match-list" :aria-busy="loading">
        <MatchCard
          v-for="game in games"
          :key="game.id"
          :game="game"
          :viewer-id="auth.user?.id"
          @replay="replayId = $event"
        />
      </div>
      <p v-if="loading" class="empty" role="status">
        {{ en ? "Loading…" : "Загрузка…" }}
      </p>
      <p v-else-if="!games.length && !error" class="empty">
        {{
          en
            ? "No games match these filters."
            : "По выбранным фильтрам партий пока нет."
        }}
      </p>
      <div v-if="nextCursor && !error" class="empty">
        <button :disabled="loading" @click="load(true)">
          {{ en ? "Load more" : "Показать ещё" }}
        </button>
      </div>
    </template>
    <GameReplayModal
      v-if="replayId !== null"
      :game-id="replayId"
      :title="`${en ? 'Game' : 'Партия'} #${replayId}`"
      @close="replayId = null"
    />
  </section>
</template>
<style scoped>
h1 {
  font-size: 22px;
}
.history-controls {
  padding: 16px;
}
.scope-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.filters label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 13px;
  flex: 1 1 150px;
}
.filters select,
.filters input {
  width: 100%;
  min-width: 0;
}
.match-list {
  display: grid;
  gap: 14px;
  padding: 0 16px 16px;
}
</style>
