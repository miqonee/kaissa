import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

/** Fit the whole board column (names, reserves and board), not just the square. */
export function useGameLayout() {
  const gameRoot = ref<HTMLElement | null>(null);
  const boardsRoot = ref<HTMLElement | null>(null);
  const compactLayout = ref(false);
  let observer: ResizeObserver | undefined;
  let animationFrame = 0;
  let media: MediaQueryList | undefined;

  function fit(): void {
    animationFrame = 0;
    const root = boardsRoot.value;
    if (!root) return;
    const columns = [...root.querySelectorAll<HTMLElement>('[data-board-column]')];
    // Scrolling to the partner board or opening chat must not grow the board.
    const top = (columns[0]?.getBoundingClientRect().top ?? 0) + window.scrollY;
    const layout = gameRoot.value?.querySelector<HTMLElement>('.game-layout');
    const gap = layout ? parseFloat(getComputedStyle(layout).rowGap) || 0 : 0;
    const safeBottom = gameRoot.value ? parseFloat(getComputedStyle(gameRoot.value).paddingBottom) || 0 : 0;
    const bughouse = root.classList.contains('two-boards');
    const paired = bughouse && window.innerWidth >= 760;
    const drawer = compactLayout.value || bughouse;
    const fullWidth = gameRoot.value?.clientWidth ?? root.clientWidth;
    const widget = bughouse ? gameRoot.value?.querySelector<HTMLElement>('.chat-widget-root') : null;
    const sizes: { column: HTMLElement; size: number; sideSpace: number }[] = [];
    for (const column of columns) {
      const board = column.querySelector<HTMLElement>('.board-frame');
      if (!board) continue;
      const rect = column.getBoundingClientRect();
      const chrome = rect.height - board.getBoundingClientRect().height;
      const viewport = window.visualViewport;
      // Opening the software keyboard must not resize the game behind the chat.
      if (document.activeElement?.tagName === 'INPUT') continue;
      const bottomSpace = bughouse ? 12 + safeBottom : drawer ? 38 + gap + 12 + safeBottom : 12;
      let availableHeight = (viewport?.height ?? window.innerHeight) - Math.max(0, top) - chrome - bottomSpace;
      const sideSpace = parseFloat(getComputedStyle(column).getPropertyValue('--board-side-space')) || 0;
      let availableWidth = column.classList.contains('team-board-wrapper') ? root.clientWidth : column.clientWidth;
      if (bughouse) {
        availableWidth = paired ? (fullWidth - 12) / 2 : fullWidth;
      } else if (sideSpace && !column.classList.contains('team-board-wrapper')) {
        availableWidth = compactLayout.value ? (layout?.clientWidth ?? column.clientWidth)
          : (root.clientWidth - (parseFloat(getComputedStyle(root).columnGap) || 0)) / 2;
      }
      availableWidth -= sideSpace;
      if (widget) {
        const tools = widget.getBoundingClientRect();
        const candidate = Math.max(120, Math.min(availableWidth, availableHeight));
        const width = paired ? 2 * (candidate + sideSpace) + 12 : Math.min(fullWidth, Math.max(320, candidate + sideSpace));
        const left = (gameRoot.value?.getBoundingClientRect().left ?? 0) + (fullWidth - width) / 2
          + (paired ? columns.indexOf(column) * (candidate + sideSpace + 12) : 0);
        const right = left + (paired ? candidate + sideSpace : width);
        // Test the unconstrained size, so fitting away from the widget cannot
        // alternate with growing back into it on the next ResizeObserver pass.
        if (tools.left < right && tools.right > left) {
          let limit = tools.top - Math.max(0, top) - chrome - 12;
          if (paired) {
            const center = (gameRoot.value?.getBoundingClientRect().left ?? 0) + fullWidth / 2;
            const beside = (2 * (tools.left - 12 - center) - 12) / 2 - sideSpace;
            limit = Math.max(limit, beside);
          }
          availableHeight = Math.min(availableHeight, limit);
        }
      }
      const collapsed = !paired && compactLayout.value && column.classList.contains('partner-board') && column.classList.contains('partner-collapsed');
      const size = Math.floor(Math.max(120, Math.min(availableWidth, availableHeight, collapsed ? 180 : Infinity)));
      sizes.push({ column, size, sideSpace });
    }
    const commonSize = paired ? Math.min(...sizes.map(item => item.size)) : null;
    for (const { column, size: fitted, sideSpace } of sizes) {
      const size = commonSize ?? fitted;
      const value = `${size}px`;
      if (column.style.getPropertyValue('--board-size') !== value) column.style.setProperty('--board-size', value);
      if (bughouse && column === columns[0] && gameRoot.value) {
        const width = paired ? 2 * (size + sideSpace) + 12 : Math.min(fullWidth, Math.max(320, size + sideSpace));
        const group = `${width}px`;
        if (gameRoot.value.style.getPropertyValue('--boards-width') !== group) gameRoot.value.style.setProperty('--boards-width', group);
      }
    }
  }
  function schedule(): void { if (!animationFrame) animationFrame = requestAnimationFrame(fit); }
  function updateMedia(): void { compactLayout.value = media?.matches ?? false; schedule(); }
  watch([gameRoot, boardsRoot], async () => {
    await nextTick();
    observer?.disconnect();
    observer = new ResizeObserver(schedule);
    if (gameRoot.value) observer.observe(gameRoot.value);
    const tools = gameRoot.value?.querySelector('.chat-widget-root');
    if (tools) observer.observe(tools);
    const header = document.querySelector('.app-shell > .topbar');
    if (header) observer.observe(header);
    if (boardsRoot.value) {
      observer.observe(boardsRoot.value);
      boardsRoot.value.querySelectorAll('[data-board-column]').forEach(column => observer!.observe(column));
    }
    schedule();
  });
  onMounted(() => {
    media = window.matchMedia('(max-width: 1024px)');
    media.addEventListener('change', updateMedia);
    updateMedia();
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    void document.fonts?.ready.then(schedule);
  });
  onBeforeUnmount(() => {
    observer?.disconnect();
    cancelAnimationFrame(animationFrame);
    media?.removeEventListener('change', updateMedia);
    window.removeEventListener('resize', schedule);
    window.visualViewport?.removeEventListener('resize', schedule);
  });
  return { gameRoot, boardsRoot, compactLayout };
}
