import { ref, onMounted, onBeforeUnmount } from 'vue';
import type { LobbySummary, LiveGameInfo } from 'shared';
import { getSocket, onSocketResync } from '../api/socket';
import { api } from '../api/rest';
import { useI18n } from '../stores/i18n';

export function useHomeFeed(onInvite: (lobbyId?: string, name?: string) => void) {
  const i18n = useI18n();
  const lobbies = ref<LobbySummary[]>([]);
  const liveGames = ref<LiveGameInfo[]>([]);
  const liveLoaded = ref(false);
  const loadingLobbies = ref(true);
  const lobbyError = ref('');
  let socket = getSocket();
  async function loadLobbies() {
    loadingLobbies.value = true; lobbyError.value = '';
    try {
      const res = await api.get<{ lobbies: LobbySummary[] }>('/api/lobbies');
      if (res.lobbies) lobbies.value = res.lobbies;
    } catch { lobbyError.value = i18n.locale === 'en' ? 'Could not load tables. Check your connection.' : 'Не удалось загрузить столы. Проверьте соединение.'; } finally {
      loadingLobbies.value = false;
    }
  }
  function subscribeLive() {
    // Реконнект сокета теряет комнаты live/lobby-list — подписаться заново
    offResync = onSocketResync(() => {
      socket.emit('live:subscribe');
      socket.emit('lobby-list:subscribe');
    });
    socket.on('lobby:list:update', (list) => { lobbies.value = list; lobbyError.value = ''; });
    socket.on('live:snapshot', (games) => { liveGames.value = games; liveLoaded.value = true; });
    socket.on('live:new', (g) => {
      liveGames.value = [g, ...liveGames.value.filter((x) => x.gameId !== g.gameId)];
    });
    socket.on('live:update', (g) => {
      const i = liveGames.value.findIndex((x) => x.gameId === g.gameId);
      if (i >= 0) liveGames.value.splice(i, 1, g);
      else liveGames.value.unshift(g);
    });
    socket.on('live:end', ({ gameId }) => {
      liveGames.value = liveGames.value.filter((x) => x.gameId !== gameId);
    });
    socket.on('user:notif', (n) => {
      if (n.type === 'lobby_invite' || n.type === 're_match' || n.type === 'game_invite') {
        onInvite(n.lobbyId, n.lobbyName);
      }
    });
    socket.emit('live:subscribe');
    socket.emit('lobby-list:subscribe');
  }
  let offResync: (() => void) | null = null;

  function unsubscribeLive() {
    offResync?.();
    offResync = null;
    socket.off('lobby:list:update');
    socket.off('live:snapshot');
    socket.off('live:new');
    socket.off('live:update');
    socket.off('live:end');
    socket.off('user:notif');
  }
  onBeforeUnmount(unsubscribeLive);
  function refreshSocket() { if (socket !== getSocket()) { unsubscribeLive(); socket = getSocket(); subscribeLive(); } }

  onMounted(subscribeLive);
  return { lobbies, liveGames, liveLoaded, loadingLobbies, lobbyError, loadLobbies, refreshSocket };
}
