import { useToast } from '../stores/toast';

/**
 * Открыть анализ партии на Lichess:
 * 1. Получает PGN нужной доски с сервера (/api/games/:id/pgn?board=N).
 * 2. Пытается отправить в Lichess API напрямую из браузера клиента.
 * 3. Fallback: копирует PGN в буфер обмена, открывает lichess.org/paste и показывает toast "Вставьте Ctrl+V".
 */
export async function openLichessAnalysis(gameId: number, boardIdx: number = 0): Promise<void> {
  const toast = useToast();
  let pgn = '';

  try {
    const res = await fetch(`/api/games/${gameId}/pgn?board=${boardIdx}`, { credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    pgn = await res.text();
  } catch {
    toast.show('Ошибка загрузки PGN партии');
    return;
  }

  // Попытка прямого импорта через Lichess API
  try {
    const form = new URLSearchParams();
    form.append('pgn', pgn);
    const lichessRes = await fetch('https://lichess.org/api/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: form.toString(),
    });
    if (lichessRes.ok) {
      const data = (await lichessRes.json()) as { url?: string };
      if (data.url) {
        window.open(data.url, '_blank');
        return;
      }
    }
  } catch {
    // Внешний сетевой запрос заблокирован — переходим к надёжному fallback
  }

  // Fallback: копирование в буфер + открытие страницы вставки
  try {
    await navigator.clipboard.writeText(pgn);
    toast.show('PGN скопирован в буфер. Вставьте (Ctrl+V) на открывшейся странице Lichess');
  } catch {
    toast.show('Открыта страница Lichess для вставки PGN');
  }
  window.open('https://lichess.org/paste', '_blank');
}
