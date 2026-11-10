<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { ChatMessage } from 'shared';
import AppIcon from './AppIcon.vue';
import { useI18n } from '../stores/i18n';

const props = withDefaults(
  defineProps<{
    messages: ChatMessage[];
    moves?: string[];
    myUserId?: number;
    showMoves?: boolean;
  }>(),
  {
    moves: () => [],
    myUserId: 0,
    showMoves: true,
  },
);

const emit = defineEmits<{
  (e: 'send', text: string): void;
}>();

const i18n = useI18n();
const isOpen = ref(false);
const activeTab = ref<'chat' | 'moves'>('chat');
const unreadCount = ref(0);
const draft = ref('');
const logRef = ref<HTMLElement | null>(null);
const widgetRoot = ref<HTMLElement | null>(null);
const viewportHeight = ref(0);
const keyboardOffset = ref(0);
const viewportStyle = computed(() => ({
  '--chat-keyboard-offset': `${keyboardOffset.value}px`,
  '--chat-viewport-height': `${viewportHeight.value}px`,
}));
function measureViewport(): void {
  const viewport = window.visualViewport;
  viewportHeight.value = viewport?.height ?? window.innerHeight;
  keyboardOffset.value = Math.max(0, window.innerHeight - viewportHeight.value - (viewport?.offsetTop ?? 0));
}

function scrollBottom(): void {
  nextTick(() => {
    if (logRef.value) {
      logRef.value.scrollTop = logRef.value.scrollHeight;
    }
  });
}

function toggleOpen(): void {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    widgetRoot.value?.querySelectorAll<HTMLDetailsElement>('details[open]').forEach(details => { details.open = false; });
    unreadCount.value = 0;
    scrollBottom();
  }
}

function closeDrawer(): void {
  isOpen.value = false;
}
function onToolsToggle(event: Event): void {
  if ((event.target as HTMLDetailsElement).open) isOpen.value = false;
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && isOpen.value) {
    isOpen.value = false;
  }
}

watch(
  () => props.messages.length,
  (nextLen, prevLen) => {
    if (nextLen > (prevLen ?? 0)) {
      const last = props.messages[nextLen - 1];
      if (!isOpen.value && last && last.userId !== props.myUserId) {
        unreadCount.value += 1;
      }
      if (isOpen.value && activeTab.value === 'chat') {
        scrollBottom();
      }
    }
  },
);

watch(
  () => props.moves.length,
  () => {
    if (isOpen.value && activeTab.value === 'moves') {
      scrollBottom();
    }
  },
);

function submitChat(): void {
  const t = draft.value.trim();
  if (!t) return;
  emit('send', t);
  draft.value = '';
}

onMounted(() => {
  measureViewport();
  window.addEventListener('keydown', onKeydown);
  window.addEventListener('resize', measureViewport);
  window.visualViewport?.addEventListener('resize', measureViewport);
  window.visualViewport?.addEventListener('scroll', measureViewport);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  window.removeEventListener('resize', measureViewport);
  window.visualViewport?.removeEventListener('resize', measureViewport);
  window.visualViewport?.removeEventListener('scroll', measureViewport);
});
</script>

<template>
  <div ref="widgetRoot" class="chat-widget-root" :style="viewportStyle">
    <div v-if="$slots.default" class="chat-tools" @toggle.capture="onToolsToggle"><slot /></div>
    <!-- Floating Trigger Button on Right Edge -->
    <button
      type="button"
      class="chat-fab"
      :class="{ active: isOpen, 'has-unread': unreadCount > 0 && !isOpen }"
      :aria-expanded="isOpen"
      :aria-label="showMoves ? (i18n.locale === 'en' ? 'Toggle chat and move log' : 'Открыть чат и журнал ходов') : (i18n.locale === 'en' ? 'Open match chat' : 'Открыть чат матча')"
      @click="toggleOpen"
    >
      <AppIcon name="message-square" :size="18" />
      <span class="fab-label">{{ i18n.locale === 'en' ? 'Chat' : 'Чат' }}</span>
      <span v-if="unreadCount > 0 && !isOpen" class="unread-badge">{{ unreadCount }}</span>
    </button>

    <!-- Slide-over Drawer -->
    <transition name="chat-drawer">
      <aside v-if="isOpen" class="chat-drawer panel" :aria-label="i18n.locale === 'en' ? 'Match chat' : 'Чат матча'">
        <header class="drawer-header">
          <div class="drawer-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              class="drawer-tab"
              :class="{ active: activeTab === 'chat' }"
              :aria-selected="activeTab === 'chat'"
              @click="activeTab = 'chat'; unreadCount = 0; scrollBottom()"
            >
              <AppIcon name="message-square" :size="14" />
              <span>{{ i18n.locale === 'en' ? 'Chat' : 'Чат' }}</span>
              <span class="tab-count mono">{{ messages.length }}</span>
            </button>
            <button
              v-if="showMoves"
              type="button"
              role="tab"
              class="drawer-tab"
              :class="{ active: activeTab === 'moves' }"
              :aria-selected="activeTab === 'moves'"
              @click="activeTab = 'moves'; scrollBottom()"
            >
              <AppIcon name="book-open" :size="14" />
              <span>{{ i18n.locale === 'en' ? 'Moves' : 'Ходы' }}</span>
              <span class="tab-count mono">{{ moves.length }}</span>
            </button>
          </div>
          <button
            type="button"
            class="drawer-close ghost small"
            :aria-label="i18n.locale === 'en' ? 'Close' : 'Закрыть'"
            @click="closeDrawer"
          >
            <AppIcon name="close" :size="16" />
          </button>
        </header>

        <!-- Chat Tab -->
        <div v-if="activeTab === 'chat' || !showMoves" class="drawer-body">
          <div ref="logRef" class="drawer-log">
            <div v-for="m in messages" :key="m.id" class="chat-msg" :class="{ system: m.system }">
              <template v-if="m.system">
                <span class="dim system-msg">{{ m.text }}</span>
              </template>
              <template v-else>
                <strong class="chat-user">{{ m.username }}:</strong>
                <span class="chat-text">{{ m.text }}</span>
              </template>
            </div>
            <div v-if="!messages.length" class="empty-hint dim">
              {{ i18n.locale === 'en' ? 'No messages yet. Say hello!' : 'Пока сообщений нет. Напишите первое!' }}
            </div>
          </div>
          <form class="drawer-input-row" @submit.prevent="submitChat">
            <input
              v-model="draft"
              :placeholder="i18n.locale === 'en' ? 'Message everyone…' : 'Сообщение всем…'"
              :aria-label="i18n.locale === 'en' ? 'Message everyone…' : 'Сообщение всем…'"
              maxlength="300"
            />
            <button type="submit" class="primary icon-only" :aria-label="i18n.locale === 'en' ? 'Send' : 'Отправить'">
              <AppIcon name="arrow-right" :size="15" />
            </button>
          </form>
        </div>

        <!-- Moves Tab -->
        <div v-else class="drawer-body">
          <div ref="logRef" class="drawer-log moves-log mono">
            <div v-for="(san, idx) in moves" :key="idx" class="move-entry">
              <span class="move-idx dim">{{ idx + 1 }}.</span>
              <span class="move-san">{{ san }}</span>
            </div>
            <div v-if="!moves.length" class="empty-hint dim">
              {{ i18n.locale === 'en' ? 'No moves played yet.' : 'Ходов пока нет.' }}
            </div>
          </div>
        </div>
      </aside>
    </transition>
  </div>
</template>

<style scoped>
.chat-widget-root {
  position: fixed;
  right: max(14px, env(safe-area-inset-right));
  bottom: calc(18px + env(safe-area-inset-bottom) + var(--chat-keyboard-offset, 0px));
  z-index: 60;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  max-width: calc(100vw - 28px);
}
.chat-tools:empty { display: none; }

.chat-fab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 999px;
  background: var(--surface, #1c2128);
  border: 1px solid var(--line-2, rgba(255, 255, 255, 0.14));
  color: var(--ink, #f0f4f8);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
  font-weight: 600;
  cursor: pointer;
}

.chat-fab.has-unread {
  border-color: var(--accent, #d97706);
}

.unread-badge {
  background: #dc2626;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 999px;
}

.chat-drawer {
  position: fixed;
  top: 64px;
  right: 12px;
  bottom: 68px;
  width: min(340px, calc(100vw - 24px));
  display: flex;
  flex-direction: column;
  background: var(--surface, rgba(20, 24, 31, 0.96));
  backdrop-filter: blur(12px);
  border: 1px solid var(--line-2, rgba(255, 255, 255, 0.15));
  border-radius: 12px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55);
  overflow: hidden;
  z-index: 65;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-bottom: 1px solid var(--line, rgba(255, 255, 255, 0.1));
}

.drawer-tabs {
  display: flex;
  gap: 6px;
}

.drawer-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 6px;
  background: transparent;
  border: 1px solid transparent;
  color: var(--ink-3, #9ca3af);
  font-size: 13px;
  cursor: pointer;
}

.drawer-tab.active {
  background: var(--accent-soft, rgba(255, 255, 255, 0.08));
  border-color: var(--line-2, rgba(255, 255, 255, 0.14));
  color: var(--ink, #fff);
}

.tab-count {
  font-size: 11px;
  opacity: 0.75;
}

.drawer-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.drawer-log {
  flex: 1;
  overflow-y: auto;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
}

.chat-msg {
  line-height: 1.38;
  word-break: break-word;
}

.chat-user {
  margin-right: 5px;
  color: var(--accent, #f59e0b);
}

.drawer-input-row {
  display: flex;
  gap: 6px;
  padding: 8px 10px;
  border-top: 1px solid var(--line, rgba(255, 255, 255, 0.1));
}

.drawer-input-row input {
  flex: 1;
  min-width: 0;
  font-size: 16px;
}

.moves-log {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 10px;
  align-content: start;
}

.move-entry {
  display: flex;
  gap: 6px;
  font-size: 12px;
}

.chat-drawer-enter-active,
.chat-drawer-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.chat-drawer-enter-from,
.chat-drawer-leave-to {
  opacity: 0;
  transform: translateX(18px);
}

@media (max-width: 768px) {
  .chat-drawer {
    top: auto;
    left: 8px;
    right: 8px;
    bottom: calc(64px + env(safe-area-inset-bottom) + var(--chat-keyboard-offset, 0px));
    width: auto;
    height: calc(var(--chat-viewport-height, 100dvh) * .55);
    max-height: calc(var(--chat-viewport-height, 100dvh) - 92px);
  }
}
</style>
