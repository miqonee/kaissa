import { nextTick, onBeforeUnmount, onMounted } from 'vue';

/** One initial focus of the playing area. Never fights user input or a reconnect. */
export function useInitialBoardScroll(target: () => HTMLElement | null): () => void {
  let requested = false;
  let cancelled = false;
  let frame = 0;
  const cancel = () => { cancelled = true; };
  const events = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;
  onMounted(() => events.forEach(event => window.addEventListener(event, cancel, { passive: true })));
  onBeforeUnmount(() => {
    cancelled = true;
    cancelAnimationFrame(frame);
    events.forEach(event => window.removeEventListener(event, cancel));
  });
  return () => {
    if (requested || cancelled) return;
    requested = true;
    void nextTick(() => {
      if (cancelled) return;
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          if (cancelled) return;
          const el = target();
          if (!el) return;
          const bounds = el.getBoundingClientRect();
          // Keep a complete, already visible board in place.
          if (bounds.top >= 8 && bounds.bottom <= window.innerHeight) return;
          window.scrollTo({ top: Math.max(0, bounds.top + window.scrollY - 8), behavior: 'instant' });
        });
      });
    });
  };
}
