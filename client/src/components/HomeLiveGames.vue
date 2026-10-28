<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { getBotPersonality, modeLabel as sharedModeLabel, type GameMode, type LiveGameInfo } from 'shared';
import { useConnectionStore } from '../stores/connection';
import { useI18n } from '../stores/i18n';
import ChessBoard from './ChessBoard.vue';
import BotHoverCard from './BotHoverCard.vue';
import AppIcon from './AppIcon.vue';
const props = defineProps<{ games: LiveGameInfo[]; liveLoaded: boolean }>();
const router = useRouter();
const connection = useConnectionStore();
const i18n = useI18n();
function modeLabel(m: GameMode) { return sharedModeLabel(m, i18n.locale); }
const sortedLiveGames = computed(() => {
  return props.games.slice().sort((a, b) => {
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

function teamAvgRating(players: { team: number; rating: number }[], team: number): number {
  const tp = players.filter((p) => p.team === team);
  if (!tp.length) return 1200;
  return Math.round(tp.reduce((s, p) => s + p.rating, 0) / tp.length);
}

function teamPlayers(g: LiveGameInfo, team: number): LiveGameInfo['players'] {
  return g.players.filter((p) => p.team === team);
}


function botDisplayName(p: LiveGameInfo['players'][number]): string {
  if (!p.isBot) return p.username;
  const perso = getBotPersonality(p.username);
  if (!perso) return i18n.locale === 'en' ? 'Bot' : 'Бот';
  const name = (i18n.locale === 'en' && perso.nameEn) || perso.name;
  const parts = name.split(' ');
  return parts.length > 1 ? parts[parts.length - 1] : name;
}


</script>

<template>
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
</template>

<style scoped>
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

.live-player + .live-player::before {
  content: '/';
  margin: 0 5px;
  color: var(--ink-3);
  font-weight: 400;
}
.empty { padding: 28px 16px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
</style>
