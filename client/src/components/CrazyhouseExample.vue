<script setup lang="ts">
import { computed, ref } from 'vue';
import { CrazyhouseGame } from 'shared/crazyhouse';
import type { AnyMove } from 'shared/bughouse';
import { useI18n } from '../stores/i18n';
import content from '../content/crazyhouse.json';
import ChessBoard from './ChessBoard.vue';
import PocketBar from './PocketBar.vue';
const props = defineProps<{ scenario: number }>();
const i18n = useI18n();
const t = computed(() => content[i18n.locale]);
const step = ref(0);
const frames = computed(() => {
  const fens = [undefined, '3rrr1k/8/8/8/8/8/8/4K3 w - - 0 1', '7k/1q6/8/8/8/8/8/KR6 w - - 0 1', '6rk/6pp/8/8/2B5/8/8/4K3 w - - 0 1'];
  const game = new CrazyhouseGame(false, fens[props.scenario]);
  if (props.scenario === 1 || props.scenario === 3) game.pocketOf(0, 'w').n = 1;
  if (props.scenario === 2) game.promoted[0].add('b7');
  const regular = (from: string, to: string): AnyMove => ({ board: 0, from, to });
  const lines: AnyMove[][] = [
    [regular('e2', 'e4'), regular('d7', 'd5'), regular('e4', 'd5'), regular('d8', 'd5'), { board: 0, piece: 'p', to: 'e4' }],
    [{ board: 0, piece: 'n', to: 'e2' }],
    [regular('b1', 'b7'), regular('h8', 'g8'), { board: 0, piece: 'p', to: 'e4' }],
    [{ board: 0, piece: 'n', to: 'f7' }],
  ];
  const snapshot = (move?: AnyMove) => ({ fen: game.fen(0), white: { ...game.pocketOf(0, 'w') }, black: { ...game.pocketOf(0, 'b') }, last: move ? ['from' in move ? move.from : null, move.to] : null, label: move ? ('piece' in move ? `${move.piece.toUpperCase()}@${move.to}` : `${move.from}–${move.to}`) : '', check: game.isCheck(0) ? game.boards[0].findPiece({ type: 'k', color: game.turn(0) })[0] : null });
  const result = [snapshot()];
  for (const move of lines[props.scenario]) { game.apply(move); result.push(snapshot(move)); }
  return result;
});
const frame = computed(() => frames.value[step.value]);
</script>
<template>
  <figure class="example panel">
    <figcaption><h3>{{ t.examples[scenario].title }}</h3><p>{{ t.examples[scenario].caption }}</p></figcaption>
    <PocketBar :pocket="frame.black" color="b" :interactive="false" :selected="null" :label="t.black" />
    <div class="example-board"><ChessBoard :fen="frame.fen" :last-move="frame.last" :check-square="frame.check" :coordinates="true" /></div>
    <PocketBar :pocket="frame.white" color="w" :interactive="false" :selected="null" :label="t.white" />
    <div class="example-controls"><button :disabled="step === 0" @click="step--">{{ t.back }}</button><span class="mono" aria-live="polite">{{ frame.label || t.initial }} · {{ step }}/{{ frames.length - 1 }}</span><button v-if="step < frames.length - 1" class="primary" @click="step++">{{ t.next }}</button><button v-else @click="step = 0">{{ t.reset }}</button></div>
  </figure>
</template>
<style scoped>
.example { margin: 0; padding: 18px; min-width: 0; }
h3 { margin: 0 0 10px; } figcaption p { min-height: 5em; color: var(--ink-2); line-height: 1.6; }
.example-board { width: 100%; max-width: 420px; margin: 8px auto; }
.example-controls { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-top: 14px; font-size: 12px; }
</style>
