import { nextTick, onBeforeUnmount, onMounted, type Ref } from 'vue';
/** Trap keyboard focus, restore it on close, and prevent scrolling the page behind a modal. */
export function useDialog(root: Ref<HTMLElement | null>, close: () => void): void {
  let previous: HTMLElement | null = null;
  let overflow = '';
  function onKey(event: KeyboardEvent) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (event.key !== 'Tab' || !root.value) return;
    const nodes = [...root.value.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter(el => el.getClientRects().length > 0);
    const first = nodes[0], last = nodes.at(-1);
    if (!first) { event.preventDefault(); root.value.focus(); return; }
    if (event.shiftKey && (document.activeElement === first || !root.value.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !root.value.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
  }
  onMounted(async () => {
    previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey, true);
    await nextTick();
    root.value?.querySelector<HTMLElement>('[autofocus], input, button')?.focus();
  });
  onBeforeUnmount(() => {
    document.removeEventListener('keydown', onKey, true);
    document.body.style.overflow = overflow;
    if (previous?.isConnected) previous.focus();
  });
}
