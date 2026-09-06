import { defineStore } from 'pinia';
import { ref } from 'vue';

export type ConnectionState = 'connected' | 'connecting' | 'reconnecting' | 'offline';

export const useConnectionStore = defineStore('connection', () => {
  const state = ref<ConnectionState>('connecting');
  const lastSeen = ref<number | null>(null);

  function set(s: ConnectionState) {
    if (state.value === 'connected' && s !== 'connected') lastSeen.value = Date.now();
    state.value = s;
  }

  return { state, lastSeen, set };
});
