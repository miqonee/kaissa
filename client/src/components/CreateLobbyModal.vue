<script setup lang="ts">
import { ref, computed } from 'vue';
import { isFreeForAll, modeLabel, type GameMode, type TeamMode, type TimeControl } from 'shared';
import { useI18n } from '../stores/i18n';
import { useDialog } from '../composables/useDialog';
import AppIcon from './AppIcon.vue';
import ModePicker from './ModePicker.vue';

const i18n = useI18n();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'create', payload: { name: string; mode: GameMode; timeControl: TimeControl; private: boolean; teamMode: TeamMode }): void;
}>();

const props = defineProps<{
  initialMode?: GameMode;
  busy?: boolean;
  error?: string;
}>();

const dialog = ref<HTMLElement | null>(null);
useDialog(dialog, () => { if (!props.busy) emit('close'); });

const selectedMode = ref<GameMode>(props.initialMode ?? 'bughouse');
const lobbyName = ref('');
const isPrivate = ref(false);
const selectedTeamMode = ref<TeamMode>('auto');
const tcPresets = computed<{ label: string; tc: TimeControl }[]>(() => [
  { label: '3+0', tc: { kind: 'clock', baseMin: 3, incSec: 0 } },
  { label: i18n.t.createModal.tc3plus2, tc: { kind: 'clock', baseMin: 3, incSec: 2 } },
  { label: i18n.t.createModal.tc5plus0, tc: { kind: 'clock', baseMin: 5, incSec: 0 } },
  { label: i18n.t.createModal.tc5plus3, tc: { kind: 'clock', baseMin: 5, incSec: 3 } },
  { label: i18n.t.createModal.tc10plus5, tc: { kind: 'clock', baseMin: 10, incSec: 5 } },
  { label: i18n.t.createModal.tcNoClock, tc: { kind: 'none', baseMin: 0, incSec: 0 } },
]);
const modeTc = ref<Record<GameMode, number>>({ team: 0, bughouse: 5, crazyhouse: 5, 'crazyhouse-team': 5, 'four-player': 5, 'three-player': 5, double: 5 });
const availableTcPresets = computed(() =>
  tcPresets.value,
  // All time controls allowed in all modes
  // end availableTcPresets
);
const selectedTcIdx = computed({
  get: () => {
    const idx = modeTc.value[selectedMode.value] ?? 0;
    return idx >= availableTcPresets.value.length ? 3 : idx;
  },
  set: (value) => {
    modeTc.value[selectedMode.value] = value;
  },
});

function submit() {
  if (props.busy) return;
  const tc = tcPresets.value[selectedTcIdx.value].tc;
  const defaultName = modeLabel(selectedMode.value, i18n.locale);
  const name = lobbyName.value.trim() || defaultName;
  emit('create', {
    name,
    mode: selectedMode.value,
    timeControl: tc,
    private: isPrivate.value,
    teamMode: selectedTeamMode.value,
  });
}
</script>

<template>
  <div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="create-modal-title" @click.self="!busy && emit('close')">
    <div ref="dialog" class="modal create-modal" tabindex="-1">
      <header class="modal-head">
        <h2 id="create-modal-title">{{ i18n.t.createModal.title }}</h2>
        <button class="modal-close" :disabled="busy" @click="emit('close')" :aria-label="i18n.t.createModal.cancelBtn">
          <AppIcon name="close" :size="18" />
        </button>
      </header>

      <div class="modal-body">
        <!-- Название -->
        <div class="form-row">
          <label class="field-label" for="lobby-name">{{ i18n.t.createModal.nameLabel }}</label>
          <input
            id="lobby-name"
            v-model="lobbyName"
            :placeholder="i18n.t.createModal.namePlaceholder"
            maxlength="40"
          />
        </div>

        <!-- Выбор режима с подробными правилами -->
        <div class="form-row">
          <label class="field-label">{{ i18n.t.createModal.modeLabel }}</label>
          <ModePicker v-model="selectedMode" :disabled="busy" />
        </div>

        <!-- Контроль времени -->
        <div class="form-row">
          <label class="field-label">{{ i18n.t.createModal.timeControlLabel }}</label>
          <div class="tc-grid">
            <button
              v-for="(p, i) in availableTcPresets"
              :key="p.label"
              type="button"
              class="tc-btn"
              :class="{ active: selectedTcIdx === i }"
              :aria-pressed="selectedTcIdx === i"
              @click="selectedTcIdx = i"
            >
              {{ p.label }}
            </button>
          </div>
        </div>

        <!-- Режим распределения команд -->
        <div v-if="!isFreeForAll(selectedMode)" class="form-row">
          <label class="field-label">{{ i18n.t.createModal.teamBalanceLabel }}</label>
          <div class="tc-grid">
            <button
              type="button"
              class="tc-btn"
              :class="{ active: selectedTeamMode === 'auto' }"
              @click="selectedTeamMode = 'auto'"
            >
              {{ i18n.t.createModal.teamBalanceAuto }}
            </button>
            <button
              type="button"
              class="tc-btn"
              :class="{ active: selectedTeamMode === 'random' }"
              @click="selectedTeamMode = 'random'"
            >
              {{ i18n.t.createModal.teamBalanceRandom }}
            </button>
            <button
              type="button"
              class="tc-btn"
              :class="{ active: selectedTeamMode === 'manual' }"
              @click="selectedTeamMode = 'manual'"
            >
              {{ i18n.t.createModal.teamBalanceManual }}
            </button>
          </div>
        </div>

        <!-- Приватность -->
        <div class="form-row private-row">
          <label class="checkbox-label">
            <input type="checkbox" v-model="isPrivate" />
            <span>
              <strong>{{ i18n.t.createModal.privateTable }}</strong>
              <small class="dim">{{ i18n.t.createModal.privateTableHint }}</small>
            </span>
          </label>
        </div>

        <p v-if="error" class="error-text">{{ error }}</p>
      </div>

      <footer class="modal-foot">
        <button type="button" :disabled="busy" @click="emit('close')">{{ i18n.t.createModal.cancelBtn }}</button>
        <button
          type="button"
          class="primary"
          :disabled="busy"
          @click="submit"
        >
          <AppIcon name="plus" :size="15" />
          {{ busy ? i18n.t.createModal.creatingBtn : i18n.t.createModal.createBtn }}
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.create-modal {
  width: min(1080px, calc(100vw - 32px));
  max-width: 1080px;
  max-height: 92dvh;
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
