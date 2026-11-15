<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import { MODE_GROUPS, modeGuide, type GameMode } from 'shared';
import { useI18n } from '../stores/i18n';
import ModeBoardPreview from './ModeBoardPreview.vue';
import AppIcon from './AppIcon.vue';

const props = defineProps<{ modelValue: GameMode; disabled?: boolean }>();
const emit = defineEmits<{ (e: 'update:modelValue', mode: GameMode): void }>();
const i18n = useI18n();
const id = useId();
const root = ref<HTMLElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);
const popup = ref<HTMLElement | null>(null);
const search = ref<HTMLInputElement | null>(null);
const open = ref(false);
const hoverPreview = ref(false);
const mobilePreview = ref(false);
const compact = ref(false);
const query = ref('');
const previewMode = ref<GameMode>(props.modelValue);
const popupStyle = ref<Record<string, string>>({});
const en = computed(() => i18n.locale === 'en');
const selected = computed(() => modeGuide(props.modelValue, i18n.locale));
const preview = computed(() => modeGuide(previewMode.value, i18n.locale));
const groups = computed(() => {
  const term = query.value.trim().toLocaleLowerCase();
  return MODE_GROUPS.map(group => ({ ...group, modes: group.modes.filter(mode => {
    const guide = modeGuide(mode, i18n.locale);
    return `${guide.name} ${guide.board} ${en.value ? group.en : group.ru}`.toLocaleLowerCase().includes(term);
  }) })).filter(group => group.modes.length);
});
let showTimer: ReturnType<typeof setTimeout> | undefined;
let hideTimer: ReturnType<typeof setTimeout> | undefined;
let suppressFocusPreview = false;

function clearTimers(): void { clearTimeout(showTimer); clearTimeout(hideTimer); }
function positionPopup(): void {
  if (!trigger.value || (!open.value && !hoverPreview.value)) return;
  const rect = trigger.value.getBoundingClientRect();
  compact.value = window.innerWidth <= 740;
  const width = Math.min(open.value && !compact.value ? 600 : 320, window.innerWidth - 24);
  if (open.value && compact.value) {
    popupStyle.value = { left: '12px', right: '12px', bottom: '12px', width: 'auto', maxHeight: `${window.innerHeight - 24}px` };
    return;
  }
  const below = window.innerHeight - rect.bottom - 20;
  const above = rect.top - 20;
  const useBelow = below >= Math.min(280, above);
  const maxHeight = Math.min(open.value ? 460 : 420, useBelow ? below : above);
  const height = Math.min(popup.value?.getBoundingClientRect().height || maxHeight, maxHeight);
  popupStyle.value = {
    left: `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`,
    top: `${Math.max(12, useBelow ? rect.bottom + 8 : rect.top - height - 8)}px`,
    width: `${width}px`, maxHeight: `${Math.max(120, maxHeight)}px`,
  };
}
async function showMenu(focusOption?: 'first' | 'last'): Promise<void> {
  if (props.disabled) return;
  clearTimers();
  hoverPreview.value = false;
  mobilePreview.value = false;
  previewMode.value = props.modelValue;
  query.value = '';
  open.value = true;
  positionPopup();
  await nextTick();
  positionPopup();
  const options = root.value?.querySelectorAll<HTMLButtonElement>('.mode-option');
  if (focusOption && options?.length) options[focusOption === 'first' ? 0 : options.length - 1]?.focus();
  else if (compact.value) popup.value?.focus();
  else search.value?.focus();
}
function close(restoreFocus = false): void {
  clearTimers();
  const wasOpen = open.value;
  open.value = false;
  hoverPreview.value = false;
  mobilePreview.value = false;
  if (restoreFocus && wasOpen) {
    suppressFocusPreview = true;
    void nextTick(() => trigger.value?.focus());
  }
}
function selectMode(mode: GameMode): void { emit('update:modelValue', mode); close(true); }
function inspectMode(mode: GameMode, expand = false): void {
  previewMode.value = mode;
  if (expand) mobilePreview.value = true;
}
async function backToModes(): Promise<void> {
  mobilePreview.value = false;
  await nextTick();
  root.value?.querySelector<HTMLButtonElement>(`.mode-option[data-mode="${previewMode.value}"]`)?.focus();
}
function showSelectedPreview(): void {
  if (props.disabled || open.value || suppressFocusPreview) return;
  clearTimers();
  previewMode.value = props.modelValue;
  hoverPreview.value = true;
  positionPopup();
  void nextTick(positionPopup);
}
function onTriggerEnter(event: PointerEvent): void {
  if (event.pointerType !== 'mouse') return;
  suppressFocusPreview = false;
  clearTimers();
  showTimer = setTimeout(showSelectedPreview, 180);
}
function scheduleHide(): void {
  clearTimers();
  if (!open.value) hideTimer = setTimeout(() => { hoverPreview.value = false; }, 180);
}
function onOutsidePointer(event: PointerEvent): void {
  if (event.target instanceof Node && !root.value?.contains(event.target)) close();
}
function onFocusOut(event: FocusEvent): void {
  if (event.relatedTarget instanceof Node && !root.value?.contains(event.relatedTarget)) close();
}
function onEscape(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || (!open.value && !hoverPreview.value)) return;
  event.preventDefault();
  event.stopPropagation();
  close(true);
}
function onNavigate(event: KeyboardEvent): void {
  if (!open.value || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  if (event.target === search.value && ['Home', 'End'].includes(event.key)) return;
  const options = [...root.value?.querySelectorAll<HTMLButtonElement>('.mode-option') ?? []];
  if (!options.length) return;
  event.preventDefault();
  const index = options.indexOf(document.activeElement as HTMLButtonElement);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 :
    index < 0 ? (event.key === 'ArrowDown' ? 0 : options.length - 1) :
    (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
  options[next]?.focus();
  options[next]?.scrollIntoView?.({ block: 'nearest' });
}
watch(() => props.disabled, value => { if (value) close(); });
onMounted(() => {
  document.addEventListener('pointerdown', onOutsidePointer);
  document.addEventListener('keydown', onEscape);
  window.addEventListener('resize', positionPopup);
  window.addEventListener('scroll', positionPopup, true);
});
onBeforeUnmount(() => {
  clearTimers();
  document.removeEventListener('pointerdown', onOutsidePointer);
  document.removeEventListener('keydown', onEscape);
  window.removeEventListener('resize', positionPopup);
  window.removeEventListener('scroll', positionPopup, true);
});
</script>

<template>
  <div ref="root" class="mode-picker" @keydown.esc="onEscape" @keydown="onNavigate" @focusout="onFocusOut" @pointerleave="scheduleHide">
    <button ref="trigger" type="button" class="mode-trigger" :disabled="disabled" aria-haspopup="dialog" :aria-expanded="open" :aria-controls="`${id}-modes`" :aria-label="`${en ? 'Game mode' : 'Режим игры'}: ${selected.name}`" @click="open ? close(true) : showMenu()" @keydown.down.prevent="!open && showMenu('first')" @keydown.up.prevent="!open && showMenu('last')" @pointerenter="onTriggerEnter" @focus="showSelectedPreview" @blur="suppressFocusPreview = false">
      <span>{{ selected.name }}</span><AppIcon :name="open ? 'chevron-up' : 'chevron-down'" :size="16" />
    </button>
    <div v-if="open || hoverPreview" :id="`${id}-modes`" ref="popup" class="mode-popup" tabindex="-1" :class="{ 'preview-only': !open, 'mobile-preview': mobilePreview }" :style="popupStyle" :role="open ? 'dialog' : undefined" :aria-label="en ? 'Game modes and board preview' : 'Режимы игры и предпросмотр доски'" @pointerenter="clearTimers" @pointerleave="scheduleHide">
      <div v-if="open" class="mode-menu-head">
        <button v-if="compact && mobilePreview" type="button" class="preview-back ghost" @click="backToModes"><AppIcon name="arrow-left" :size="16" />{{ en ? 'Game modes' : 'К режимам' }}</button>
        <input v-else ref="search" v-model="query" type="search" maxlength="80" :placeholder="en ? 'Find a mode' : 'Найти режим'" :aria-label="en ? 'Find a game mode' : 'Найти режим игры'" />
        <button type="button" class="ghost mode-close" :aria-label="en ? 'Close mode picker' : 'Закрыть выбор режима'" @click="close(true)"><AppIcon name="close" :size="17" /></button>
      </div>
      <div class="mode-menu-body">
        <div v-if="open" class="mode-list">
          <section v-for="group in groups" :key="group.id" class="mode-group">
            <h3>{{ en ? group.en : group.ru }}</h3>
            <div v-for="mode in group.modes" :key="mode" class="mode-row" @pointerenter="inspectMode(mode)">
              <button type="button" class="mode-option" :class="{ selected: mode === modelValue }" :data-mode="mode" :aria-pressed="mode === modelValue" @focus="inspectMode(mode)" @click="selectMode(mode)">
                <span><strong>{{ modeGuide(mode, i18n.locale).name }}</strong><small>{{ modeGuide(mode, i18n.locale).board }}</small></span><AppIcon v-if="mode === modelValue" name="check" :size="16" />
              </button>
              <button type="button" class="mode-info ghost" :aria-label="`${en ? 'Preview' : 'Предпросмотр'}: ${modeGuide(mode, i18n.locale).name}`" @focus="inspectMode(mode)" @click="inspectMode(mode, true)"><AppIcon name="eye" :size="16" /></button>
            </div>
          </section>
          <p v-if="!groups.length" class="mode-empty" role="status">{{ en ? 'No modes found' : 'Режимы не найдены' }}</p>
        </div>
        <section class="mode-detail" :aria-label="en ? 'Board preview' : 'Предпросмотр доски'">
          <h3>{{ preview.name }}</h3><span class="mode-players">{{ preview.players }}</span>
          <ModeBoardPreview :mode="previewMode" />
          <p class="mode-summary">{{ preview.summary }}</p>
          <router-link :to="preview.path" @click="close()">{{ en ? 'Rules' : 'Правила' }} →</router-link>
          <button v-if="open" type="button" class="primary mobile-select" @click="selectMode(previewMode)">{{ en ? 'Select mode' : 'Выбрать режим' }}</button>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mode-picker { min-width: 0; width: 100%; }
.mode-trigger { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; height: var(--control-size); padding: 0 12px; background: var(--surface-inset); border-color: var(--line-2); text-align: left; }
.mode-trigger > span { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.mode-trigger > svg { flex: none; color: var(--ink-2); }
.mode-popup { position: fixed; z-index: 1200; display: flex; flex-direction: column; min-height: 0; padding: 0; overflow: hidden; border: 1px solid var(--line-2); border-radius: var(--r-m); background: var(--surface); box-shadow: var(--shadow-l); }
.mode-menu-head { display: flex; align-items: center; gap: 8px; padding: 10px; border-bottom: 1px solid var(--line); flex: none; }
.mode-menu-head input { width: 100%; min-width: 0; font-size: 13px; height: 36px; }
.mode-close { flex: none; min-width: 36px; height: 36px; padding: 0; justify-content: center; }
.mode-menu-body { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr); min-height: 0; overflow: hidden; }
.mode-list { padding: 8px; overflow-y: auto; overscroll-behavior: contain; max-height: 360px; min-height: 0; }
.mode-group + .mode-group { margin-top: 12px; }
.mode-group h3 { margin: 5px 8px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: var(--ink-2); }
.mode-row { display: flex; align-items: stretch; border-radius: var(--r-s); }
.mode-row:hover, .mode-row:focus-within { background: var(--surface-2); }
.mode-option { display: flex; align-items: center; justify-content: space-between; flex: 1; min-width: 0; gap: 8px; min-height: 54px; padding: 8px; border: 0; background: transparent; border-radius: var(--r-s); text-align: left; }
.mode-option.selected { color: var(--accent); }
.mode-option > span { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.mode-option strong { font-size: 12px; line-height: 1.3; font-weight: 600; }
.mode-option small { font-size: 10px; line-height: 1.4; color: var(--ink-2); }
.mode-option svg { flex: none; }
.mode-info { display: none; }
.mode-detail { min-width: 0; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; background: var(--surface-inset); border-left: 1px solid var(--line); }
.mode-detail h3 { margin: 0; font-size: 15px; }
.mode-players, .mode-summary { font-size: 11px; color: var(--ink-2); margin: 0; line-height: 1.5; }
.mode-detail > a { font-size: 12px; align-self: flex-start; }
.mode-detail :deep(.standard-boards svg) { max-width: 150px; }
.mode-detail :deep(.multi-board-wrap) { max-width: 170px; }
.mode-detail :deep(.mode-preview.double .multi-board-wrap) { max-width: 100%; }
.mode-detail :deep(.preview-note) { display: none; }
.preview-only .mode-menu-body { display: block; overflow-y: auto; }
.preview-only .mode-detail { border: 0; }
.mode-empty { padding: 16px 8px; font-size: 12px; color: var(--ink-2); }
.mobile-select { display: none; }
@media (max-width: 740px) {
  .mode-menu-body { display: flex; flex-direction: column; }
  .mode-popup:not(.preview-only) .mode-detail { display: none; }
  .mode-info { display: flex; align-items: center; justify-content: center; min-width: 44px; padding: 0; color: var(--ink-2); }
  .mode-option { min-height: 56px; }
  .mode-option strong { font-size: 13px; }
  .mode-list { max-height: 380px; }
  .mode-popup.mobile-preview .mode-list { display: none; }
  .mode-popup.mobile-preview .mode-detail { display: flex; border: 0; }
  .mobile-select { display: flex; justify-content: center; min-height: 44px; margin-top: 4px; }
  .preview-back { gap: 8px; margin-right: auto; font-size: 13px; }
}
</style>
