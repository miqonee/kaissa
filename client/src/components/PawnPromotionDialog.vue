<script setup lang="ts">
import { computed, ref } from 'vue';
import type { PieceType } from 'shared';
import { useDialog } from '../composables/useDialog';

const props = defineProps<{ color: string; locale: 'ru' | 'en' }>();
const emit = defineEmits<{ (e: 'choose', role: PieceType): void; (e: 'cancel'): void }>();
const root = ref<HTMLElement | null>(null);
const choices: PieceType[] = ['q', 'r', 'b', 'n'];
const names = computed(() => props.locale === 'en' ? ['Queen', 'Rook', 'Bishop', 'Knight'] : ['Ферзь', 'Ладья', 'Слон', 'Конь']);
useDialog(root, () => emit('cancel'));
</script>

<template>
  <Teleport to="body">
    <div class="modal-backdrop" role="dialog" aria-modal="true" :aria-label="locale === 'en' ? 'Promote pawn' : 'Превращение пешки'" @click.self="emit('cancel')">
      <div ref="root" class="promotion-picker" tabindex="-1">
        <strong>{{ locale === 'en' ? 'Promote pawn' : 'Превращение пешки' }}</strong>
        <div class="promotion-options"><button v-for="(role, i) in choices" :key="role" :aria-label="names[i]" @click="emit('choose', role)"><img :src="`/pieces/multi/${color}${role.toUpperCase()}.svg`" :alt="names[i]" /></button></div>
        <button @click="emit('cancel')">{{ locale === 'en' ? 'Cancel' : 'Отмена' }}</button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.promotion-picker { padding: 22px; background: var(--surface); color: var(--ink); border: 1px solid var(--line); border-radius: var(--r-m); box-shadow: 0 12px 40px #0007; text-align: center; }
.promotion-options { display: flex; gap: 6px; margin: 16px 0; }
.promotion-options img { width: 44px; height: 44px; }
.promotion-options button { padding: 5px; }
</style>
