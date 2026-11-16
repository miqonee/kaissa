import { onBeforeUnmount, onMounted } from 'vue';

// Visibility affects painting only. The caller calculates elapsed wall time,
// so resuming catches up instead of giving players extra thinking time.
export function useVisualClockTicker(tick: () => void): void {
  let timer: number | undefined;
  function stop(): void {
    window.clearInterval(timer);
    timer = undefined;
  }
  function resume(): void {
    stop();
    if (document.hidden) return;
    tick();
    timer = window.setInterval(tick, 100);
  }
  onMounted(() => {
    document.addEventListener('visibilitychange', resume);
    resume();
  });
  onBeforeUnmount(() => {
    stop();
    document.removeEventListener('visibilitychange', resume);
  });
}
