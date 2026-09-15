import { describe, it, expect, vi } from 'vitest';
import { fmtDuration } from 'shared';
import {
  computeGameDurationSec,
  calculatePlatformDurationMetrics,
  type RawGameForDuration,
} from '../src/admin/durationStats.js';

describe('fmtDuration (форматирование длительности)', () => {
  it('корректно обрабатывает 0, отрицательные числа и NaN', () => {
    expect(fmtDuration(0)).toBe('0с');
    expect(fmtDuration(-10)).toBe('0с');
    expect(fmtDuration(NaN)).toBe('0с');
  });

  it('форматирует секунды', () => {
    expect(fmtDuration(5)).toBe('5с');
    expect(fmtDuration(45)).toBe('45с');
    expect(fmtDuration(59)).toBe('59с');
  });

  it('не допускает бага округления "60с"', () => {
    expect(fmtDuration(59.8)).toBe('1м');
    expect(fmtDuration(59.9)).toBe('1м');
  });

  it('форматирует точные минуты', () => {
    expect(fmtDuration(60)).toBe('1м');
    expect(fmtDuration(120)).toBe('2м');
    expect(fmtDuration(180)).toBe('3м');
  });

  it('не допускает бага округления "1м 60с"', () => {
    expect(fmtDuration(119.8)).toBe('2м');
    expect(fmtDuration(119.9)).toBe('2м');
  });

  it('форматирует минуты и секунды', () => {
    expect(fmtDuration(65)).toBe('1м 5с');
    expect(fmtDuration(135)).toBe('2м 15с');
    expect(fmtDuration(536)).toBe('8м 56с'); // Та самая аномальная длительность из тикета
  });

  it('форматирует часы, минуты и секунды', () => {
    expect(fmtDuration(3600)).toBe('1ч');
    expect(fmtDuration(3660)).toBe('1ч 1м');
    expect(fmtDuration(3665)).toBe('1ч 1м 5с');
    expect(fmtDuration(7200)).toBe('2ч');
    expect(fmtDuration(7325)).toBe('2ч 2м 5с');
  });
});

describe('computeGameDurationSec (расчет длительности партии)', () => {
  const now = Date.now();

  it('возвращает 0, если endedAt не задан', () => {
    const res = computeGameDurationSec({
      baseMin: 3,
      incSec: 0,
      noClock: false,
      startedAt: new Date(now),
      endedAt: null,
    });
    expect(res.durationSec).toBe(0);
  });

  it('для обычной партии 3+0 возвращает фактическое время, если оно укладывается в тайм-контроль', () => {
    const started = new Date(now);
    const ended = new Date(now + 185_000); // 3м 5с
    const res = computeGameDurationSec({
      baseMin: 3,
      incSec: 0,
      noClock: false,
      startedAt: started,
      endedAt: ended,
      _count: { moves: 30 },
    });
    expect(res.durationSec).toBe(185);
    expect(res.isNoClock).toBe(false);
    expect(res.tcLabel).toBe('3+0');
  });

  it('для партии 3+0 с долгим AFK до 1-го хода отсекает время свыше лимита часов', () => {
    const started = new Date(now);
    const ended = new Date(now + 1200_000); // 20 минут в БД из-за ожидания
    const res = computeGameDurationSec({
      baseMin: 3,
      incSec: 0,
      noClock: false,
      startedAt: started,
      endedAt: ended,
      _count: { moves: 25 },
    });
    // Максимум: 2 * 180с + 0 + 30с запаса = 390с (6м 30с) вместо 1200с (20 минут)
    expect(res.durationSec).toBe(390);
  });

  it('для партии 5+0 ограничивает длительность лимитом часов с запасом', () => {
    const started = new Date(now);
    const ended = new Date(now + 1800_000); // 30 минут
    const res = computeGameDurationSec({
      baseMin: 5,
      incSec: 0,
      noClock: false,
      startedAt: started,
      endedAt: ended,
      _count: { moves: 40 },
    });
    // Максимум: 2 * 300с + 0 + 30с = 630с (10м 30с)
    expect(res.durationSec).toBe(630);
    expect(res.tcLabel).toBe('5+0');
  });

  it('для партии с инкрементом 5+3 учитывает ходы при расчете потолка', () => {
    const started = new Date(now);
    const ended = new Date(now + 420_000); // 7 минут (420с)
    const res = computeGameDurationSec({
      baseMin: 5,
      incSec: 3,
      noClock: false,
      startedAt: started,
      endedAt: ended,
      _count: { moves: 30 },
    });
    // Потолок: 2 * 300 + 30 * 3 + 30 = 720с, фактическое 420с меньше потолка
    expect(res.durationSec).toBe(420);
    expect(res.tcLabel).toBe('5+3');
  });

  it('если в партии 0 ходов (отмена/быстрый лив), ограничивает длительность 30 секундами', () => {
    const started = new Date(now);
    const ended = new Date(now + 600_000); // 10 минут висела пустая комната
    const res = computeGameDurationSec({
      baseMin: 5,
      incSec: 0,
      noClock: false,
      startedAt: started,
      endedAt: ended,
      _count: { moves: 0 },
    });
    expect(res.durationSec).toBe(30);
  });

  it('для партий noClock: true фиксирует статус "Без часов" и ограничивает выбросы 2 часами', () => {
    const started = new Date(now);
    const ended = new Date(now + 900_000); // 15 минут
    const res = computeGameDurationSec({
      baseMin: 0,
      incSec: 0,
      noClock: true,
      startedAt: started,
      endedAt: ended,
      _count: { moves: 20 },
    });
    expect(res.durationSec).toBe(900);
    expect(res.isNoClock).toBe(true);
    expect(res.tcLabel).toBe('Без часов');

    // 24 часа забытой вкладки -> ограничивается 7200с
    const ended24h = new Date(now + 86400_000);
    const res24h = computeGameDurationSec({
      baseMin: 0,
      incSec: 0,
      noClock: true,
      startedAt: started,
      endedAt: ended24h,
      _count: { moves: 20 },
    });
    expect(res24h.durationSec).toBe(7200);
  });

  it('распознает noClock при baseMin=0 и incSec=0 даже если флаг noClock=false', () => {
    const res = computeGameDurationSec({
      baseMin: 0,
      incSec: 0,
      noClock: false,
      startedAt: new Date(now),
      endedAt: new Date(now + 300_000),
    });
    expect(res.isNoClock).toBe(true);
    expect(res.tcLabel).toBe('Без часов');
  });
});

describe('calculatePlatformDurationMetrics (расчет общих метрик платформы)', () => {
  const baseTime = 1700000000000;

  it('возвращает нули при пустой выборке', () => {
    const res = calculatePlatformDurationMetrics([]);
    expect(res.avgGameDurationSec).toBe(0);
    expect(res.durationStats.timedAvgSec).toBe(0);
    expect(res.durationStats.timedCount).toBe(0);
    expect(res.durationStats.noClockCount).toBe(0);
    expect(res.durationStats.byTimeControl).toEqual([]);
  });

  it('устраняет аномалию 8м 56с: среднее время timed-партий не раздувается партиями без часов', () => {
    const games: RawGameForDuration[] = [
      // 3+0 партии: длятся ~3 минуты (180с)
      {
        baseMin: 3,
        incSec: 0,
        noClock: false,
        mode: 'team',
        startedAt: new Date(baseTime),
        endedAt: new Date(baseTime + 180_000),
        _count: { moves: 30 },
      },
      {
        baseMin: 3,
        incSec: 0,
        noClock: false,
        mode: 'team',
        startedAt: new Date(baseTime),
        endedAt: new Date(baseTime + 160_000),
        _count: { moves: 25 },
      },
      // 5+0 партии: длятся ~5 минут (300с)
      {
        baseMin: 5,
        incSec: 0,
        noClock: false,
        mode: 'bughouse',
        startedAt: new Date(baseTime),
        endedAt: new Date(baseTime + 300_000),
        _count: { moves: 35 },
      },
      {
        baseMin: 5,
        incSec: 0,
        noClock: false,
        mode: 'bughouse',
        startedAt: new Date(baseTime),
        endedAt: new Date(baseTime + 320_000),
        _count: { moves: 40 },
      },
      // 1 старая бесконечная тестовая партия без часов (40 минут = 2400с)
      {
        baseMin: 0,
        incSec: 0,
        noClock: true,
        mode: 'team',
        startedAt: new Date(baseTime),
        endedAt: new Date(baseTime + 2400_000),
        _count: { moves: 20 },
      },
    ];

    const res = calculatePlatformDurationMetrics(games);

    // Партии с часами: (180 + 160 + 300 + 320) / 4 = 960 / 4 = 240 секунд (4м 0с).
    // До фикса среднее по всем 5 партиям с 2400с партией составляло: (960 + 2400) / 5 = 672с (11м 12с)!
    expect(res.avgGameDurationSec).toBe(240);
    expect(fmtDuration(res.avgGameDurationSec)).toBe('4м');

    // Детальная статистика
    expect(res.durationStats.timedAvgSec).toBe(240);
    expect(res.durationStats.timedCount).toBe(4);
    expect(res.durationStats.noClockAvgSec).toBe(2400);
    expect(res.durationStats.noClockCount).toBe(1);

    // Разбивка по режимам
    // team с часами: 180, 160; без часов: 2400 -> (180+160+2400)/3 = 2740/3 = 913с
    expect(res.durationStats.byMode.teamSec).toBe(913);
    // bughouse: 300, 320 -> 310с
    expect(res.durationStats.byMode.bughouseSec).toBe(310);

    // Разбивка по контролям
    const tc3 = res.durationStats.byTimeControl.find((t) => t.label === '3+0');
    expect(tc3).toBeDefined();
    expect(tc3?.avgSec).toBe(170); // (180 + 160) / 2
    expect(tc3?.count).toBe(2);

    const tc5 = res.durationStats.byTimeControl.find((t) => t.label === '5+0');
    expect(tc5).toBeDefined();
    expect(tc5?.avgSec).toBe(310); // (300 + 320) / 2
    expect(tc5?.count).toBe(2);

    const tcNoClock = res.durationStats.byTimeControl.find((t) => t.label === 'Без часов');
    expect(tcNoClock).toBeDefined();
    expect(tcNoClock?.avgSec).toBe(2400);
    expect(tcNoClock?.count).toBe(1);
  });

  it('если сыграны только партии без часов, avgGameDurationSec берет их среднее', () => {
    const games: RawGameForDuration[] = [
      {
        baseMin: 0,
        incSec: 0,
        noClock: true,
        mode: 'team',
        startedAt: new Date(baseTime),
        endedAt: new Date(baseTime + 600_000), // 10 мин
        _count: { moves: 15 },
      },
      {
        baseMin: 0,
        incSec: 0,
        noClock: true,
        mode: 'team',
        startedAt: new Date(baseTime),
        endedAt: new Date(baseTime + 1200_000), // 20 мин
        _count: { moves: 25 },
      },
    ];

    const res = calculatePlatformDurationMetrics(games);
    expect(res.durationStats.timedCount).toBe(0);
    expect(res.durationStats.noClockCount).toBe(2);
    expect(res.avgGameDurationSec).toBe(900); // 15 минут
    expect(fmtDuration(res.avgGameDurationSec)).toBe('15м');
  });
  describe('adminRouter /metrics prisma query verification', () => {
    it('запрашивает prisma.game с сортировкой endedAt: desc, take: 200 и нужными полями', async () => {
      const { adminRouter } = await import('../src/admin/adminRouter.js');
      const { prisma } = await import('../src/prisma.js');

      let capturedArgs: any = null;
      vi.spyOn(prisma.user, 'count').mockResolvedValue(10 as any);
      vi.spyOn(prisma.game, 'count').mockResolvedValue(50 as any);
      vi.spyOn(prisma.gameMove, 'count').mockResolvedValue(500 as any);
      vi.spyOn(prisma.game, 'findMany').mockImplementation(((args: any) => {
        capturedArgs = args;
        return Promise.resolve([
          {
            id: 1,
            mode: 'team',
            baseMin: 3,
            incSec: 0,
            noClock: false,
            startedAt: new Date(1700000000000),
            endedAt: new Date(1700000180000),
            _count: { moves: 30 },
          },
        ]);
      }) as any);
      vi.spyOn(prisma.user, 'findMany').mockResolvedValue([] as any);
      vi.spyOn(prisma.gameParticipant, 'findMany').mockResolvedValue([] as any);

      const metricsLayer = adminRouter.stack.find((l: any) => l.route?.path === '/metrics');
      const handler = metricsLayer?.route?.stack[0]?.handle;
      expect(handler).toBeDefined();

      let jsonPayload: any = null;
      const req = {} as any;
      const res = {
        json: (data: any) => { jsonPayload = data; },
        status: () => res,
      } as any;

      await handler!(req, res, () => {});

      expect(capturedArgs).toBeDefined();
      expect(capturedArgs.where).toEqual({ status: 'finished', endedAt: { not: null } });
      expect(capturedArgs.orderBy).toEqual({ endedAt: 'desc' });
      expect(capturedArgs.take).toBe(200);
      expect(capturedArgs.select.baseMin).toBe(true);
      expect(capturedArgs.select.incSec).toBe(true);
      expect(capturedArgs.select.noClock).toBe(true);
      expect(capturedArgs.select._count).toBeDefined();

      expect(jsonPayload).toBeDefined();
      expect(jsonPayload.avgGameDurationSec).toBe(180);
      expect(jsonPayload.durationStats).toBeDefined();
      expect(jsonPayload.durationStats.timedAvgSec).toBe(180);
    });
  });

});

