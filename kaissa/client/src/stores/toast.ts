import { ref } from 'vue';

const toastText = ref<string | null>(null);
let toastTimer: number | undefined;

export function useToast() {
  function show(text: string, durationMs: number = 4000) {
    toastText.value = text;
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toastText.value = null;
    }, durationMs);
  }

  function hide() {
    toastText.value = null;
    clearTimeout(toastTimer);
  }

  return { toastText, show, hide };
}
