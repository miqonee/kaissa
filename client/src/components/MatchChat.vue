<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { ChatMessage } from 'shared';
import { useI18n } from '../stores/i18n';
import AppIcon from './AppIcon.vue';

const props = defineProps<{ messages: ChatMessage[]; modelValue: string; drawer: boolean; open: boolean; unread: number }>();
const emit = defineEmits<{ 'update:modelValue': [value: string]; toggle: []; close: []; send: [] }>();
const i18n = useI18n();
const log = ref<HTMLElement | null>(null);
const input = ref<HTMLInputElement | null>(null);
const toggle = ref<HTMLButtonElement | null>(null);
const panel = ref<HTMLElement | null>(null);
const viewportHeight = ref(0);
const mobile = ref(false);
const modalDrawer = computed(() => props.drawer && mobile.value);
const keyboardOffset = ref(0);
let previousBodyStyle: Pick<CSSStyleDeclaration, 'position' | 'top' | 'left' | 'width' | 'overflow'> | null = null;
let savedScroll = { x: 0, y: 0 };
let locked = false;
function unlockPage(): void {
  if (!locked) return;
  if (previousBodyStyle) Object.assign(document.body.style, previousBodyStyle);
  if (window.scrollX !== savedScroll.x || window.scrollY !== savedScroll.y) window.scrollTo(savedScroll.x, savedScroll.y);
  locked = false;
}
const drawerStyle = computed(() => props.drawer && props.open ? {
  bottom: `${keyboardOffset.value + 8}px`,
  height: `${Math.min(440, viewportHeight.value - 24)}px`,
} : undefined);

function measureViewport(): void {
  mobile.value = window.innerWidth <= 720;
  const viewport = window.visualViewport;
  viewportHeight.value = viewport?.height ?? window.innerHeight;
  keyboardOffset.value = Math.max(0, window.innerHeight - (viewport?.height ?? window.innerHeight) - (viewport?.offsetTop ?? 0));
}
async function scrollToEnd(): Promise<void> {
  await nextTick();
  if (log.value) log.value.scrollTop = log.value.scrollHeight;
}
watch(() => props.messages.length, () => { void scrollToEnd(); });
watch(() => modalDrawer.value && props.open, (lock) => {
  if (lock) {
    const style = document.body.style;
    previousBodyStyle = { position: style.position, top: style.top, left: style.left, width: style.width, overflow: style.overflow };
    savedScroll = { x: window.scrollX, y: window.scrollY };
    Object.assign(style, { position: 'fixed', top: `${-savedScroll.y}px`, left: `${-savedScroll.x}px`, width: `${document.documentElement.clientWidth}px`, overflow: 'hidden' });
    locked = true;
  } else unlockPage();
}, { immediate: true });
watch(() => props.drawer && props.open, async (open, wasOpen) => {
  if (!open && !wasOpen) return;
  await nextTick();
  if (open) { void scrollToEnd(); input.value?.focus({ preventScroll: true }); }
  else toggle.value?.focus({ preventScroll: true });
}, { immediate: true });
function onKey(event: KeyboardEvent): void {
  if (props.drawer && props.open && event.key === 'Escape') { event.preventDefault(); emit('close'); }
  if (!modalDrawer.value || !props.open || event.key !== 'Tab') return;
  const nodes = panel.value?.querySelectorAll<HTMLElement>('button, input');
  const first = nodes?.[0], last = nodes?.[nodes.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
}
onMounted(() => {
  measureViewport();
  window.addEventListener('resize', measureViewport);
  window.visualViewport?.addEventListener('resize', measureViewport);
  window.visualViewport?.addEventListener('scroll', measureViewport);
  document.addEventListener('keydown', onKey);
  void scrollToEnd();
});
onBeforeUnmount(() => {
  unlockPage();
  window.removeEventListener('resize', measureViewport);
  window.visualViewport?.removeEventListener('resize', measureViewport);
  window.visualViewport?.removeEventListener('scroll', measureViewport);
  document.removeEventListener('keydown', onKey);
});
defineExpose({ scrollToEnd });
</script>

<template>
  <section class="match-chat" :class="{ drawer, 'is-open': open }" :aria-label="i18n.t.matchChat.title">
    <button v-if="drawer" ref="toggle" type="button" class="chat-toggle" :aria-expanded="open" @click="emit('toggle')">
      <AppIcon name="message-square" :size="16" /><span>{{ i18n.t.matchChat.title }}</span>
      <span v-if="unread && !open" class="unread">{{ unread }}</span>
      <span class="message-count mono">{{ messages.length }}</span>
      <AppIcon :name="open ? 'chevron-down' : 'chevron-up'" :size="15" />
    </button>
    <Teleport to="body" :disabled="!drawer">
      <div v-if="modalDrawer && open" class="match-chat-shade" @click="emit('close')"></div>
      <div ref="panel" v-show="!drawer || open" class="match-chat-panel panel" :class="{ floating: drawer }" :style="drawerStyle"
        :role="drawer ? 'dialog' : undefined" :aria-modal="modalDrawer ? true : undefined" :aria-label="i18n.t.matchChat.title">
        <header class="panel-head">
          <AppIcon name="message-square" :size="15" /><h3>{{ i18n.t.matchChat.title }}</h3>
          <span class="message-count mono">{{ messages.length }}</span>
          <button v-if="drawer" class="small ghost icon-only" :aria-label="i18n.t.matchChat.close" @click="emit('close')"><AppIcon name="close" :size="16" /></button>
        </header>
        <div ref="log" class="match-chat-log" role="log" aria-live="polite" aria-relevant="additions">
          <div v-for="message in messages" :key="message.id" class="chat-message" :class="{ system: message.system }">
            <span v-if="!message.system" class="chat-author">{{ message.username }}: </span><span>{{ message.text }}</span>
          </div>
          <p v-if="!messages.length" class="chat-empty">{{ i18n.t.matchChat.empty }}</p>
        </div>
        <form class="match-chat-input" @submit.prevent="emit('send')">
          <input ref="input" :value="modelValue" :placeholder="i18n.t.matchChat.placeholder" :aria-label="i18n.t.matchChat.placeholder"
            maxlength="300" @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)" />
          <button type="submit" class="primary icon-only" :aria-label="i18n.t.matchChat.send"><AppIcon name="arrow-right" :size="16" /></button>
        </form>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.match-chat { flex: 1; display: flex; min-height: 0; min-width: 0; }
.match-chat-panel { display: flex; flex-direction: column; flex: 1; min-height: 0; width: 100%; overflow: hidden; margin: 0; }
.match-chat-panel .panel-head { flex: none; gap: 6px; }
.match-chat-panel h3 { font-size: 13px; margin: 0; }
.message-count { margin-left: auto; color: var(--ink-3); font-size: 11px; }
.match-chat-log { flex: 1; min-height: 0; overflow-y: auto; overflow-anchor: none; overscroll-behavior: contain; padding: 10px 12px; scrollbar-gutter: stable; }
.chat-message { font-size: 12.5px; line-height: 1.45; overflow-wrap: anywhere; margin-bottom: 6px; }
.chat-author { font-weight: 600; color: var(--accent-2); }
.system, .chat-empty { font-size: 12px; color: var(--ink-3); }
.match-chat-input { display: flex; flex: none; gap: 6px; padding: 8px 10px; border-top: 1px solid var(--line); }
.match-chat-input input { flex: 1; width: 0; min-width: 0; font-size: 16px; }
.drawer { flex: none; height: 38px; }
.chat-toggle { width: 100%; height: 38px; justify-content: flex-start; padding: 0 10px; }
.unread { background: var(--accent); color: var(--accent-ink); font-size: 11px; padding: 1px 6px; border-radius: 12px; }
.match-chat-shade { position: fixed; inset: 0; background: rgb(0 0 0 / .3); z-index: 79; }
.match-chat-panel.floating { position: fixed; z-index: 80; left: max(8px, env(safe-area-inset-left)); right: max(8px, env(safe-area-inset-right)); width: auto; padding-bottom: env(safe-area-inset-bottom); max-height: calc(100dvh - 24px); box-shadow: var(--shadow-l); }
@media (min-width: 721px) {
  .match-chat-panel.floating { left: auto; right: 12px; width: min(380px, calc(100vw - 24px)); }
}
</style>
