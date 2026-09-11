<script setup lang="ts">
import { ref } from 'vue';
import { MODE_INFO, type GameMode, type TeamMode, type TimeControl } from 'shared';
import AppIcon from './AppIcon.vue';

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'create', payload: { name: string; mode: GameMode; timeControl: TimeControl; isPrivate: boolean; teamMode: TeamMode }): void;
}>();

defineProps<{
  busy?: boolean;
  error?: string;
}>();

const selectedMode = ref<GameMode>('bughouse');
const lobbyName = ref('');
const isPrivate = ref(false);
const selectedTeamMode = ref<TeamMode>('auto');
const expandedRules = ref<Record<GameMode, boolean>>({
  bughouse: false,
  team: false,
});

function toggleRules(mode: GameMode) {
  expandedRules.value[mode] = !expandedRules.value[mode];
}

const TC_PRESETS: { label: string; tc: TimeControl }[] = [
  { label: '3+2 блиц', tc: { kind: 'clock', baseMin: 3, incSec: 2 } },
  { label: '5+0 блиц', tc: { kind: 'clock', baseMin: 5, incSec: 0 } },
  { label: '5+3 блиц', tc: { kind: 'clock', baseMin: 5, incSec: 3 } },
  { label: '10+5 рапид', tc: { kind: 'clock', baseMin: 10, incSec: 5 } },
  { label: 'Без часов', tc: { kind: 'none', baseMin: 0, incSec: 0 } },
];
const selectedTcIdx = ref(2); // 5+3 по умолчанию

function submit() {
  const tc = TC_PRESETS[selectedTcIdx.value].tc;
  const name = lobbyName.value.trim() || (selectedMode.value === 'bughouse' ? 'Багхаус' : 'Матч 2×2');
  emit('create', {
    name,
    mode: selectedMode.value,
    timeControl: tc,
    isPrivate: isPrivate.value,
    teamMode: selectedTeamMode.value,
  });
}
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="modal create-modal">
      <div class="modal-head">
        <h2>Создание лобби</h2>
        <button class="modal-close" @click="emit('close')" aria-label="Закрыть">
          <AppIcon name="close" :size="18" />
        </button>
      </div>

      <div class="modal-body">
        <!-- Название -->
        <div class="form-row">
          <label class="field-label">Название стола</label>
          <input
            v-model="lobbyName"
            placeholder="Например: Пятничный багхаус, Партия мастеров…"
            maxlength="40"
          />
        </div>

        <!-- Выбор режима с подробными правилами -->
        <div class="form-row">
          <label class="field-label">Выберите режим</label>
          <div class="mode-cards">
            <div
              v-for="info in MODE_INFO"
              :key="info.mode"
              class="mode-card"
              :class="{ active: selectedMode === info.mode }"
              @click="selectedMode = info.mode"
            >
              <div class="mode-card-head">
                <span class="mode-title">{{ info.title }}</span>
                <span v-if="selectedMode === info.mode" class="mode-check">
                  <AppIcon name="check" :size="13" :stroke-width="2.6" />
                </span>
              </div>
              <p class="mode-short">{{ info.short }}</p>
              <button
                type="button"
                class="mode-rules-toggle"
                @click.stop="toggleRules(info.mode)"
              >
                <span>{{ expandedRules[info.mode] ? 'Скрыть правила' : 'Правила режима' }}</span>
                <AppIcon :name="expandedRules[info.mode] ? 'chevron-up' : 'chevron-down'" :size="13" />
              </button>
              <ul v-if="expandedRules[info.mode]" class="mode-rules">
                <li v-for="(r, i) in info.rules" :key="i">{{ r }}</li>
                <li v-if="info.mode === 'bughouse'">Только живые игроки — боты отключены</li>
              </ul>
            </div>
          </div>
        </div>

        <!-- Контроль времени -->
        <div class="form-row">
          <label class="field-label">Контроль времени</label>
          <div class="tc-grid">
            <button
              v-for="(p, i) in TC_PRESETS"
              :key="p.label"
              type="button"
              class="tc-btn"
              :class="{ active: selectedTcIdx === i }"
              @click="selectedTcIdx = i"
            >
              {{ p.label }}
            </button>
          </div>
        </div>

        <!-- Режим распределения команд -->
        <div class="form-row">
          <label class="field-label">Распределение команд</label>
          <div class="tc-grid">
            <button
              type="button"
              class="tc-btn"
              :class="{ active: selectedTeamMode === 'auto' }"
              @click="selectedTeamMode = 'auto'"
            >
              Авто (по Elo)
            </button>
            <button
              type="button"
              class="tc-btn"
              :class="{ active: selectedTeamMode === 'random' }"
              @click="selectedTeamMode = 'random'"
            >
              Случайно
            </button>
            <button
              type="button"
              class="tc-btn"
              :class="{ active: selectedTeamMode === 'manual' }"
              @click="selectedTeamMode = 'manual'"
            >
              Свои команды (ручной)
            </button>
          </div>
        </div>

        <!-- Приватность -->
        <div class="form-row private-row">
          <label class="checkbox-label">
            <input type="checkbox" v-model="isPrivate" />
            <span>
              <strong>Приватное лобби</strong>
              <small class="dim">Не будет отображаться в общем списке столов. Вход только по 6-значному коду или прямой ссылке.</small>
            </span>
          </label>
        </div>

        <p v-if="error" class="error-text">{{ error }}</p>
      </div>

      <div class="modal-foot">
        <button type="button" @click="emit('close')">Отмена</button>
        <button type="button" class="primary big" :disabled="busy" @click="submit">
          {{ busy ? 'Создаём…' : 'Создать стол' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.create-modal {
  max-width: 620px;
  max-height: min(92vh, 700px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.create-modal :deep(.modal-body),
.modal-body {
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  padding: 14px 20px;
}

.create-modal :deep(.modal-foot),
.modal-foot {
  flex-shrink: 0;
  padding: 12px 20px;
  background: var(--surface-2);
}

.form-row {
  margin-bottom: 12px;
}
.form-row:last-child {
  margin-bottom: 0;
}

.mode-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
@media (max-width: 600px) {
  .mode-cards {
    grid-template-columns: 1fr;
  }
}

.mode-card {
  border: 1.5px solid var(--line-2);
  border-radius: var(--r-m);
  padding: 12px 14px;
  background: var(--surface-inset);
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  flex-direction: column;
}

.mode-card:hover {
  border-color: var(--accent-2);
  background: color-mix(in srgb, var(--accent-2) 6%, var(--surface-inset));
}

.mode-card.active {
  border-color: var(--accent-2);
  box-shadow: 0 0 0 2px var(--accent-2);
  background: var(--surface-2);
}

.mode-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.mode-title {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 700;
  color: var(--ink);
}

.mode-check {
  background: var(--accent-2);
  color: var(--accent-ink);
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.mode-short {
  font-size: 12px;
  color: var(--ink-2);
  margin: 0 0 6px;
  line-height: 1.35;
}

.mode-rules-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: none;
  color: var(--ink-2);
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  padding: 2px 0;
  margin-top: auto;
  align-self: flex-start;
  opacity: 0.85;
  transition: opacity 0.15s, color 0.15s;
}

.mode-rules-toggle:hover {
  opacity: 1;
  color: var(--ink);
}

.mode-rules {
  margin: 8px 0 0;
  padding-left: 16px;
  font-size: 11.5px;
  color: var(--ink-3);
  line-height: 1.4;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.tc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 6px;
}

.tc-btn {
  padding: 6px 8px;
  border-radius: var(--r-s);
  border: 1px solid var(--line-2);
  background: var(--surface-inset);
  color: var(--ink-2);
  font-size: 12.5px;
  font-weight: 500;
}

.tc-btn:hover {
  border-color: var(--accent-2);
  color: var(--ink);
}

.tc-btn.active {
  border-color: var(--accent-2);
  background: color-mix(in srgb, var(--accent-2) 16%, var(--surface-2));
  color: var(--ink);
  font-weight: 600;
}

.private-row {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--line);
}

.checkbox-label {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  cursor: pointer;
  font-size: 13px;
}

.checkbox-label input {
  width: 16px;
  height: 16px;
  margin-top: 2px;
  cursor: pointer;
}

.checkbox-label strong {
  display: block;
  color: var(--ink);
  margin-bottom: 2px;
}

.checkbox-label small {
  display: block;
  font-size: 11.5px;
  line-height: 1.35;
}
</style>
