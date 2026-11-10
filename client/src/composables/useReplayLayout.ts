import { nextTick, onBeforeUnmount, ref, watch } from 'vue';

export function useReplayLayout() {
  const replayRoot = ref<HTMLElement | null>(null);
  let observer: ResizeObserver | undefined;
  let pending = 0;
  function fit(): void {
    pending = 0;
    const body = replayRoot.value?.querySelector<HTMLElement>('.replayer-body');
    const boards = replayRoot.value?.querySelector<HTMLElement>('.rp-boards');
    if (!body || !boards) return;
    const columns = [...boards.querySelectorAll<HTMLElement>('.rp-board-col')];
    const gap = parseFloat(getComputedStyle(boards).columnGap) || 0;
    const across = getComputedStyle(boards).gridTemplateColumns.split(' ').length;
    const width = (boards.clientWidth - gap * (across - 1)) / across;
    for (const column of columns) {
      const stage = column.querySelector<HTMLElement>('.rp-board-stage');
      if (!stage) continue;
      const chrome = column.getBoundingClientRect().height - stage.getBoundingClientRect().height;
      // On small phones the content scrolls; keep the board readable rather than
      // shrinking it to make room for every reserve and analysis panel at once.
      const minimum = window.innerWidth <= 720 ? Math.min(260, width) : 120;
      const size = `${Math.floor(Math.max(minimum, Math.min(width, body.clientHeight - chrome)))}px`;
      if (column.style.getPropertyValue('--replay-board-size') !== size) column.style.setProperty('--replay-board-size', size);
    }
  }
  function schedule(): void { if (!pending) pending = requestAnimationFrame(fit); }
  watch(replayRoot, async () => {
    await nextTick();
    observer?.disconnect();
    if (!replayRoot.value) return;
    observer = new ResizeObserver(schedule);
    observer.observe(replayRoot.value);
    replayRoot.value.querySelectorAll('.replayer-body, .rp-boards').forEach(el => observer!.observe(el));
    schedule();
  });
  onBeforeUnmount(() => { observer?.disconnect(); cancelAnimationFrame(pending); });
  return { replayRoot };
}
