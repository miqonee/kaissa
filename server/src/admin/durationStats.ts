import type { GameDurationStats, DurationByTimeControl } from 'shared';

export interface RawGameForDuration {
  id?: number;
  mode?: string;
  baseMin: number;
  incSec: number;
  noClock: boolean;
  startedAt: Date;
  endedAt: Date | null;
  _count?: { moves: number };
}

export interface ComputedGameDuration {
  durationSec: number;
  isNoClock: boolean;
  tcLabel: string;
  mode: string;
}

/**
 * Рассчитывает длительность отдельной партии с учетом контроля времени,
 * отсекая аномальные простои (AFK перед 1-м ходом, зависшие подключения).
 */
export function computeGameDurationSec(g: RawGameForDuration): ComputedGameDuration {
  const isNoClock = g.noClock || (g.baseMin === 0 && g.incSec === 0);
  const tcLabel = isNoClock ? 'Без часов' : `${g.baseMin}+${g.incSec}`;
  const mode = g.mode || 'team';

  if (!g.endedAt) {
    return { durationSec: 0, isNoClock, tcLabel, mode };
  }

  const rawSec = Math.max(0, (g.endedAt.getTime() - g.startedAt.getTime()) / 1000);

  if (isNoClock) {
    // Для нелимитированных партий без часов ограничиваем верхним порогом 2 часа (7200 с),
    // чтобы забытые открытые вкладки не давали астрономические значения.
    return { durationSec: Math.min(rawSec, 7200), isNoClock, tcLabel, mode };
  }

  // Для партий с контролем времени:
  const movesCount = g._count?.moves ?? 0;
  if (movesCount === 0) {
    // Партия завершилась без ходов (быстрая отмена / сдача до хода): реальное игровое время минимально
    return { durationSec: Math.min(rawSec, 30), isNoClock, tcLabel, mode };
  }

  // Суммарный банк времени на часах для обеих сторон:
  // 2 * baseMin * 60 секунд + накопленный инкремент на сделанные ходы.
  // Добавляем до 30 секунд допустимого запаса на паузу перед первым ходом (до активации часов)
  // и сетевые задержки.
  const maxClockSec = 2 * (g.baseMin * 60) + movesCount * g.incSec + 30;
  const durationSec = Math.min(rawSec, maxClockSec);

  return { durationSec, isNoClock, tcLabel, mode };
}

/**
 * Рассчитывает среднюю длительность и детализированную статистику по выборке партий:
 * - avgGameDurationSec: среднее время партий с контролем времени (не искажается партиями без часов)
 * - durationStats: разбивка по режимам, контролям времени и типам (с часами / без часов)
 */
export function calculatePlatformDurationMetrics(games: RawGameForDuration[]): {
  avgGameDurationSec: number;
  durationStats: GameDurationStats;
} {
  if (!games.length) {
    return {
      avgGameDurationSec: 0,
      durationStats: {
        avgSec: 0,
        timedAvgSec: 0,
        timedCount: 0,
        noClockAvgSec: 0,
        noClockCount: 0,
        byMode: { teamSec: 0, bughouseSec: 0 },
        byTimeControl: [],
      },
    };
  }

  const processed = games.map(computeGameDurationSec);

  const timed = processed.filter((p) => !p.isNoClock);
  const noClock = processed.filter((p) => p.isNoClock);

  const totalSec = processed.reduce((sum, p) => sum + p.durationSec, 0);
  const avgSec = Math.round(totalSec / processed.length);

  const timedTotalSec = timed.reduce((sum, p) => sum + p.durationSec, 0);
  const timedAvgSec = timed.length ? Math.round(timedTotalSec / timed.length) : 0;

  const noClockTotalSec = noClock.reduce((sum, p) => sum + p.durationSec, 0);
  const noClockAvgSec = noClock.length ? Math.round(noClockTotalSec / noClock.length) : 0;

  // Главная метрика avgGameDurationSec:
  // Если есть партии с тайм-контролями (3+0, 5+0 и т.д.), она отражает именно их,
  // исключая искажения от бесконечных тестовых игр без таймера.
  // Если же сыграны только партии без таймера, берется их среднее.
  const avgGameDurationSec = timed.length ? timedAvgSec : noClockAvgSec;

  // Разбивка по режимам
  const teamGames = processed.filter((p) => p.mode === 'team');
  const bughouseGames = processed.filter((p) => p.mode === 'bughouse');

  const teamSec = teamGames.length
    ? Math.round(teamGames.reduce((sum, p) => sum + p.durationSec, 0) / teamGames.length)
    : 0;
  const bughouseSec = bughouseGames.length
    ? Math.round(bughouseGames.reduce((sum, p) => sum + p.durationSec, 0) / bughouseGames.length)
    : 0;

  // Разбивка по контролям времени
  const tcMap = new Map<string, { totalSec: number; count: number }>();
  for (const p of processed) {
    let entry = tcMap.get(p.tcLabel);
    if (!entry) {
      entry = { totalSec: 0, count: 0 };
      tcMap.set(p.tcLabel, entry);
    }
    entry.totalSec += p.durationSec;
    entry.count += 1;
  }

  const byTimeControl: DurationByTimeControl[] = Array.from(tcMap.entries())
    .map(([label, stat]) => ({
      label,
      avgSec: Math.round(stat.totalSec / stat.count),
      count: stat.count,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    avgGameDurationSec,
    durationStats: {
      avgSec,
      timedAvgSec,
      timedCount: timed.length,
      noClockAvgSec,
      noClockCount: noClock.length,
      byMode: {
        teamSec,
        bughouseSec,
      },
      byTimeControl,
    },
  };
}
