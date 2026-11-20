<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId } from 'vue';
import AppIcon from './AppIcon.vue';

const props = defineProps<{
  label: string;
  modelValue: string;
  options: readonly { value: string; label: string }[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  change: [value: string];
}>();

const uid = useId();
const listId = `${uid}-list`;
const labelId = `${uid}-label`;
const optionId = (index: number) => `${uid}-option-${index}`;
const trigger = ref<HTMLButtonElement | null>(null);
const list = ref<HTMLElement | null>(null);
const expanded = ref(false);
const active = ref(-1);
const position = ref({ left: '0px', top: '0px', width: '180px', maxHeight: '280px' });
const positioned = ref(false);
const selected = computed(() => props.options.findIndex(option => option.value === props.modelValue));
const selectedLabel = computed(() => props.options[selected.value]?.label ?? '');
let search = '';
let lastTyped = 0;

function positionList() {
  if (!trigger.value || !list.value || !expanded.value) return;
  const rect = trigger.value.getBoundingClientRect();
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
  const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
  if (rect.bottom < 0 || rect.top > viewportHeight) {
    close();
    return;
  }
  const margin = 8;
  const gap = 5;
  const width = Math.max(0, Math.min(Math.max(rect.width, 180), viewportWidth - margin * 2));
  // Measure option wrapping at the final width before choosing an opening direction.
  const widthPx = `${width}px`;
  if (position.value.width !== widthPx) {
    position.value.width = widthPx;
    void nextTick(positionList);
    return;
  }
  const left = Math.max(margin, Math.min(rect.left, viewportWidth - width - margin));
  const below = viewportHeight - rect.bottom - gap - margin;
  const above = rect.top - gap - margin;
  const maxMenuHeight = 280;
  const desiredHeight = Math.min(list.value.scrollHeight + 2, maxMenuHeight);
  const openAbove = below < desiredHeight && above > below;
  const height = Math.max(0, Math.min(maxMenuHeight, openAbove ? above : below));
  position.value = {
    left: `${left}px`,
    top: `${openAbove ? Math.max(margin, rect.top - gap - Math.min(height, desiredHeight)) : rect.bottom + gap}px`,
    width: widthPx,
    maxHeight: `${height}px`,
  };
  if (!positioned.value) {
    positioned.value = true;
    void nextTick(scrollToActive);
  }
}

function scrollToActive() {
  const row = list.value?.children.item(active.value) as HTMLElement | null | undefined;
  if (!row || !list.value) return;
  const top = row.offsetTop;
  const bottom = top + row.offsetHeight;
  if (top < list.value.scrollTop) list.value.scrollTop = top;
  else if (bottom > list.value.scrollTop + list.value.clientHeight) list.value.scrollTop = bottom - list.value.clientHeight;
}

function setActive(index: number) {
  active.value = Math.max(0, Math.min(index, props.options.length - 1));
  if (positioned.value) void nextTick(scrollToActive);
}

function open(index = Math.max(0, selected.value)) {
  if (!props.options.length) return;
  expanded.value = true;
  void nextTick(positionList);
  setActive(index);
}

function close() {
  expanded.value = false;
  positioned.value = false;
  active.value = -1;
  search = '';
  lastTyped = 0;
}

function choose(index: number) {
  const option = props.options[index];
  close();
  if (!option || option.value === props.modelValue) return;
  emit('update:modelValue', option.value);
  emit('change', option.value);
}

function onKeydown(event: KeyboardEvent) {
  if (event.ctrlKey || event.metaKey || (event.altKey && event.key !== 'ArrowDown')) return;
  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowUp':
      event.preventDefault();
      if (!expanded.value) open(selected.value < 0 && event.key === 'ArrowUp' ? props.options.length - 1 : undefined);
      else if (!event.altKey) setActive(active.value + (event.key === 'ArrowDown' ? 1 : -1));
      return;
    case 'Home':
    case 'End': {
      event.preventDefault();
      const index = event.key === 'Home' ? 0 : props.options.length - 1;
      if (expanded.value) setActive(index);
      else open(index);
      return;
    }
    case 'Enter':
    case ' ':
      event.preventDefault();
      if (expanded.value) choose(active.value);
      else open();
      return;
    case 'Escape':
      if (!expanded.value) return;
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    case 'Tab':
      if (expanded.value) choose(active.value);
      return;
  }

  if (event.key.length !== 1) return;
  event.preventDefault();
  const char = event.key.toLocaleLowerCase();
  const now = Date.now();
  search = now - lastTyped < 650 ? search + char : char;
  lastTyped = now;
  const repeated = search.length > 1 && [...search].every(value => value === char);
  const current = expanded.value ? active.value : selected.value;
  const start = search.length === 1 || repeated ? current + 1 : Math.max(0, current);
  const prefix = repeated ? char : search;
  for (let i = 0; i < props.options.length; i++) {
    const index = (start + i) % props.options.length;
    if (props.options[index].label.toLocaleLowerCase().startsWith(prefix)) {
      if (expanded.value) setActive(index);
      else open(index);
      return;
    }
  }
}

function onToggle() {
  if (expanded.value) close();
  else {
    trigger.value?.focus({ preventScroll: true });
    open();
  }
}

function onOutsidePointer(event: PointerEvent) {
  if (!expanded.value || !(event.target instanceof Node)) return;
  if (!trigger.value?.contains(event.target) && !list.value?.contains(event.target)) close();
}

onMounted(() => {
  document.addEventListener('pointerdown', onOutsidePointer, true);
  window.addEventListener('scroll', positionList, { capture: true, passive: true });
  window.addEventListener('resize', positionList);
});
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onOutsidePointer, true);
  window.removeEventListener('scroll', positionList, true);
  window.removeEventListener('resize', positionList);
});
</script>

<template>
  <div class="admin-select">
    <span :id="labelId" class="admin-select__label">{{ label }}</span>
    <button
      ref="trigger"
      type="button"
      role="combobox"
      class="admin-select__trigger"
      :aria-labelledby="labelId"
      :aria-controls="expanded ? listId : undefined"
      :aria-activedescendant="expanded && active >= 0 ? optionId(active) : undefined"
      :aria-expanded="expanded"
      :disabled="!options.length"
      @click="onToggle"
      @keydown="onKeydown"
      @blur="close"
    >
      <span :title="selectedLabel">{{ selectedLabel }}</span>
      <AppIcon name="chevron-down" size="15" />
    </button>
    <Teleport to="body">
      <ul
        v-if="expanded"
        :id="listId"
        ref="list"
        role="listbox"
        :aria-labelledby="labelId"
        class="admin-select__list"
        :style="{ ...position, visibility: positioned ? undefined : 'hidden' }"
      >
        <li
          v-for="(option, index) in options"
          :id="optionId(index)"
          :key="option.value"
          role="option"
          :aria-selected="option.value === modelValue"
          :class="{ 'is-active': active === index }"
          @mousedown.prevent
          @click="choose(index)"
        >
          <span>{{ option.label }}</span>
          <AppIcon v-if="option.value === modelValue" name="check" size="16" />
        </li>
      </ul>
    </Teleport>
  </div>
</template>

<style scoped>
.admin-select {
  display: grid;
  gap: 6px;
  min-inline-size: 134px;
}
.admin-select__label {
  color: var(--ink-2);
  font-size: 12px;
}
button.admin-select__trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
  min-height: 40px;
  padding: 8px 10px 8px 12px;
  background: var(--surface-2);
  border: 1px solid var(--line-2);
  border-radius: var(--r-s);
  color: var(--ink);
  font-size: 13px;
  text-align: start;
}
.admin-select__trigger span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.admin-select__trigger svg { color: var(--ink-2); }
button.admin-select__trigger:hover,
button.admin-select__trigger[aria-expanded="true"] {
  border-color: var(--accent);
}
button.admin-select__trigger[aria-expanded="true"] svg {
  transform: rotate(180deg);
  color: var(--accent);
}
button.admin-select__trigger:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.admin-select__list {
  box-sizing: border-box;
  position: fixed;
  z-index: 80;
  margin: 0;
  padding: 4px;
  overflow: auto;
  overscroll-behavior: contain;
  list-style: none;
  background: var(--surface);
  color: var(--ink);
  border: 1px solid var(--line-2);
  border-radius: var(--r-s);
  box-shadow: var(--shadow-m);
  font-size: 13px;
}
.admin-select__list [role="option"] {
  display: grid;
  grid-template-columns: 1fr 16px;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  border-radius: calc(var(--r-s) - 2px);
  padding: 7px 8px;
  cursor: pointer;
  overflow-wrap: anywhere;
}
.admin-select__list [aria-selected="true"] {
  font-weight: 600;
}
.admin-select__list svg { color: var(--accent); }
.admin-select__list [role="option"]:hover,
.admin-select__list .is-active {
  background: var(--accent-soft);
}
</style>
