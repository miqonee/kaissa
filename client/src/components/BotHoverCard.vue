<script setup lang="ts">
import { computed, ref, onBeforeUnmount } from 'vue';
import { getBotPersonality, eloToLevel, BOT_LEVELS } from 'shared';

const props = defineProps<{
  username?: string | null;
  rating?: number | null;
}>();

const isVisible = ref(false);
const triggerRef = ref<HTMLElement | null>(null);
const pos = ref({ top: 0, left: 0, placement: 'top' as 'top' | 'bottom' });

const personality = computed(() => getBotPersonality(props.username));
const currentElo = computed(() => props.rating ?? personality.value?.defaultElo ?? 1200);
const level = computed(() => eloToLevel(currentElo.value));
const levelConfig = computed(() => BOT_LEVELS[level.value - 1] || BOT_LEVELS[3]);

let hideTimeout: number | null = null;

function show() {
  if (!personality.value) return;
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }
  if (!triggerRef.value) return;
  const rect = triggerRef.value.getBoundingClientRect();
  const cardWidth = 290;
  const cardHeight = 150;

  let left = rect.left + rect.width / 2 - cardWidth / 2;
  left = Math.max(12, Math.min(window.innerWidth - cardWidth - 12, left));

  let top = rect.top - cardHeight - 8;
  let placement: 'top' | 'bottom' = 'top';

  if (top < 12) {
    top = rect.bottom + 8;
    placement = 'bottom';
  }

  pos.value = { top, left, placement };
  isVisible.value = true;
}

function hide() {
  hideTimeout = window.setTimeout(() => {
    isVisible.value = false;
  }, 60);
}

onBeforeUnmount(() => {
  if (hideTimeout) clearTimeout(hideTimeout);
});
</script>

<template>
  <span
    ref="triggerRef"
    class="bot-hover-trigger"
    @mouseenter="show"
    @mouseleave="hide"
  >
    <slot />

    <Teleport to="body">
      <Transition name="bot-hover-fade">
        <div
          v-if="isVisible && personality"
          class="bot-hover-card"
          :class="pos.placement"
          :style="{ top: `${pos.top}px`, left: `${pos.left}px` }"
        >
          <!-- Шапка: персона, уровень и Elo -->
          <div class="card-head">
            <div class="bot-identity">
              <strong class="bot-name">{{ personality.name }}</strong>
            </div>
            <span class="bot-level-chip mono">
              Ур.{{ level }} · {{ currentElo }} Elo
            </span>
          </div>

          <!-- Стиль и титул -->
          <div class="card-meta">
            <span class="bot-badge-tag">{{ personality.badge }}</span>
            <span class="bot-title">{{ personality.title }}</span>
          </div>

          <!-- Описание характера игры -->
          <p class="bot-desc">{{ personality.description }}</p>

          <!-- Дебютные предпочтения -->
          <div v-if="personality.openingsPreference?.length" class="bot-openings">
            <span class="openings-label">Дебюты:</span>
            <span
              v-for="op in personality.openingsPreference"
              :key="op"
              class="opening-chip mono"
            >{{ op }}</span>
          </div>
        </div>
      </Transition>
    </Teleport>
  </span>
</template>

<style scoped>
.bot-hover-trigger {
  display: inline-flex;
  align-items: center;
  cursor: help;
}

.bot-hover-card {
  position: fixed;
  width: 290px;
  background: rgba(22, 22, 28, 0.96);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(234, 179, 8, 0.4);
  border-radius: 10px;
  padding: 12px 14px;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.75), 0 0 16px rgba(234, 179, 8, 0.15);
  z-index: 99999;
  pointer-events: none;
  font-family: inherit;
  color: #f3f4f6;
  text-align: left;
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.bot-identity {
  display: flex;
  align-items: center;
  min-width: 0;
}

.bot-name {
  font-size: 13.5px;
  font-weight: 700;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bot-level-chip {
  font-size: 11px;
  font-weight: 700;
  background: rgba(234, 179, 8, 0.15);
  color: #facc15;
  border: 1px solid rgba(234, 179, 8, 0.35);
  padding: 2px 6px;
  border-radius: 6px;
  white-space: nowrap;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.bot-badge-tag {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: rgba(99, 102, 241, 0.22);
  color: #c7d2fe;
  border: 1px solid rgba(99, 102, 241, 0.45);
  padding: 1px 5px;
  border-radius: 4px;
}

.bot-title {
  font-size: 11.5px;
  font-weight: 600;
  color: #e5e7eb;
}

.bot-desc {
  font-size: 11px;
  line-height: 1.4;
  color: #9ca3af;
  margin: 0 0 8px 0;
}

.bot-openings {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.openings-label {
  font-size: 10px;
  color: #6b7280;
  margin-right: 2px;
}

.opening-chip {
  font-size: 9.5px;
  background: rgba(255, 255, 255, 0.08);
  color: #d1d5db;
  padding: 1px 5px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.bot-hover-fade-enter-active,
.bot-hover-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.bot-hover-fade-enter-from,
.bot-hover-fade-leave-to {
  opacity: 0;
  transform: scale(0.96) translateY(3px);
}
</style>
