<script setup lang="ts">
import { computed, ref } from "vue";
import { modeLabel, timeControlLabel, type GameSummary } from "shared";
import { useI18n } from "../stores/i18n";
import { matchOutcome, ratingLabel, endReason } from "../utils/match";
import { openLichessAnalysis } from "../api/lichess";
const analyzing = ref(false);
async function analyze() { analyzing.value = true; try { await openLichessAnalysis(props.game.id); } finally { analyzing.value = false; } }
const props = defineProps<{
  game: GameSummary;
  viewerId?: number;
  compact?: boolean;
}>();
const emit = defineEmits<{ (e: "replay", id: number): void }>();
const i18n = useI18n();
const en = computed(() => i18n.locale === "en");
const myTeam = computed(
  () => props.game.participants.find((p) => p.userId === props.viewerId)?.team,
);
const teams = computed(() => [myTeam.value ?? 1, myTeam.value === 2 ? 1 : 2]);
const date = computed(() =>
  new Date(props.game.startedAt).toLocaleString(en.value ? "en-US" : "ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }),
);
</script>
<template>
  <article
    class="match-card"
    :aria-label="`${en ? 'Game' : 'Партия'} #${game.id}`"
  >
    <header>
      <div class="badges">
        <span class="badge">{{ modeLabel(game.mode, i18n.locale) }}</span
        ><span class="badge">{{
          game.timeControl.kind === "none"
            ? en
              ? "No clock"
              : "Без часов"
            : timeControlLabel(game.timeControl)
        }}</span
        ><span class="badge" :class="{ on: game.ratingKind === 'rated' }">{{
          ratingLabel(game, i18n.locale)
        }}</span>
      </div>
      <small class="dim">#{{ game.id }} · {{ date }}</small>
    </header>
    <div class="teams">
      <section
        v-for="team in teams"
        :key="team"
        :class="{ yours: team === myTeam }"
      >
        <h3>
          {{
            myTeam
              ? team === myTeam
                ? en
                  ? "Your team"
                  : "Ваша команда"
                : en
                  ? "Opponents"
                  : "Соперники"
              : en
                ? `Team ${team}`
                : `Команда ${team}`
          }}
        </h3>
        <div
          v-for="p in game.participants.filter((p) => p.team === team)"
          :key="p.userId"
          class="player"
        >
          <div class="player-identity">
            <router-link :to="`/players/${encodeURIComponent(p.username)}`">{{
              p.username
            }}</router-link
            ><span v-if="p.userId === viewerId" class="badge">{{
              en ? "You" : "Вы"
            }}</span
            ><span v-if="p.isBot || p.isGuest" class="badge">{{
              p.isBot
                ? en
                  ? "Bot"
                  : "Бот"
                : en
                  ? "Guest at start"
                  : "Гость при старте"
            }}</span>
            <small class="dim"
              >{{
                game.mode === "bughouse"
                  ? `${en ? "Board" : "Доска"} ${p.boardIndex + 1} · `
                  : ""
              }}{{
                p.color === "w"
                  ? en
                    ? "White"
                    : "Белые"
                  : en
                    ? "Black"
                    : "Чёрные"
              }}</small
            >
          </div>
          <div class="player-rating mono" v-if="!p.isBot && !p.isGuest">
            <template
              v-if="
                game.status === 'finished' &&
                p.ratingAfter != null &&
                (game.ratingKind === 'rated' || !game.ratingKind)
              "
              >{{ p.ratingBefore }} → {{ p.ratingAfter }}
              <strong
                :class="{
                  positive: p.ratingAfter > p.ratingBefore,
                  negative: p.ratingAfter < p.ratingBefore,
                }"
                >({{ p.ratingAfter > p.ratingBefore ? "+" : ""
                }}{{ p.ratingAfter - p.ratingBefore }})</strong
              ></template
            >
            <template v-else
              >{{ p.ratingBefore }}
              <small class="dim">{{
                en ? "before game" : "до партии"
              }}</small></template
            >
          </div>
        </div>
      </section>
    </div>
    <footer>
      <div>
        <strong>{{ matchOutcome(game, viewerId, i18n.locale) }}</strong>
        <p class="dim">{{ endReason(game, i18n.locale) }}</p>
        <small
          v-if="game.ratingKind && game.ratingKind !== 'rated'"
          class="dim"
          >{{
            en ? "Public ratings unchanged" : "Публичный рейтинг не меняется"
          }}</small
        >
      </div>
      <router-link
        v-if="game.status === 'active'"
        class="button small"
        :to="`/game/${game.id}`"
        >{{ en ? "Watch" : "Смотреть" }}</router-link
      >
      <div v-else-if="!compact" class="match-actions">
        <button class="small brass" @click="emit('replay', game.id)">{{ en ? 'Replay' : 'Смотреть партию' }}</button>
        <a class="button small ghost" :href="`/api/games/${game.id}/pgn?download=1`">{{ en ? 'Download PGN' : 'Скачать PGN' }}</a>
        <button v-if="game.mode !== 'bughouse'" class="small ghost" :disabled="analyzing" @click="analyze">{{ analyzing ? (en ? 'Opening…' : 'Открываем…') : (en ? 'Analyze on Lichess' : 'Анализ на Lichess') }}</button>
      </div>
    </footer>
  </article>
</template>
<style scoped>
.match-actions { display:flex; flex-wrap:wrap; gap:8px; }
.match-card {
  border: 1px solid var(--line, var(--ink-3));
  border-radius: 10px;
  padding: 18px;
  background: var(--bg);
}
header,
footer {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
}
.badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.teams {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin: 16px 0;
}
.teams section {
  min-width: 0;
  padding: 12px;
  background: var(--panel, transparent);
  border: 1px solid var(--line, var(--ink-3));
  border-radius: 8px;
}
.teams section.yours {
  border-color: var(--accent);
}
h3 {
  font-size: 14px;
  margin-bottom: 10px;
}
.player {
  padding: 7px 0;
}
.player-identity {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.player-identity a {
  overflow-wrap: anywhere;
}
.player-identity small {
  flex-basis: 100%;
}
.player-rating {
  font-size: 13px;
  margin-top: 5px;
}
.positive {
  color: var(--success, #398458);
}
.negative {
  color: var(--danger, #c35757);
}
footer p {
  margin: 3px 0;
  font-size: 13px;
}
@media (max-width: 600px) {
  .teams {
    grid-template-columns: 1fr;
  }
  .match-card {
    padding: 12px;
  }
}
</style>
