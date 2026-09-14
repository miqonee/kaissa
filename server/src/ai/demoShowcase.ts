// server/src/ai/demoShowcase.ts
// Фоновая демо-витрина партий ботов на главной странице (in-memory TV с ID 1 и 2)
import { eloToLevel, levelToElo } from 'shared';
import { prisma } from '../prisma.js';
import type { GamesManager } from '../game/manager.js';

export async function cleanupPureBotGames(): Promise<void> {
  try {
    // Удаляем исключительно партии, где 100% участников — боты (нет ни одного человека)
    const botGames = await prisma.game.findMany({
      where: {
        AND: [
          {
            participants: {
              some: {
                user: { isBot: true },
              },
            },
          },
          {
            participants: {
              none: {
                user: { isBot: false },
              },
            },
          },
        ],
      },
      select: { id: true },
    });
    if (botGames.length > 0) {
      const ids = botGames.map((g) => g.id);
      await prisma.gameMove.deleteMany({ where: { gameId: { in: ids } } });
      await prisma.gameParticipant.deleteMany({ where: { gameId: { in: ids } } });
      await prisma.game.deleteMany({ where: { id: { in: ids } } });
      console.log(`[cleanup] Удалено ${botGames.length} старых партий ботов из базы данных`);
    }
  } catch (e) {
    console.error('[cleanup] Ошибка очистки партий ботов:', e);
  }
}

export class DemoShowcase {
  private games: GamesManager | null = null;
  private currentDemoGameId: number | null = null;
  private nextSlot: 1 | 2 = 1;
  private checkInterval: NodeJS.Timeout | null = null;
  private running = false;
  private isTransitioning = false;
  private levelRotationIndex = 0;

  start(games: GamesManager): void {
    this.games = games;
    this.running = true;
    if (!this.checkInterval) {
      this.checkInterval = setInterval(() => void this.tick(), 1500);
    }
    void this.tick();
  }

  stop(): void {
    this.running = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  private async tick(): Promise<void> {
    if (!this.running || !this.games || this.isTransitioning) return;

    if (this.currentDemoGameId) {
      const active = this.games.getActive(this.currentDemoGameId);
      if (active && active.status === 'active') {
        return; // партия ещё идёт
      }
      // Партия завершена (мат, пат, недостаток материала и т.д.)
      this.isTransitioning = true;
      const finishedId = this.currentDemoGameId;
      // Зрители видят результат 4 секунды
      setTimeout(async () => {
        try {
          await this.launchNextDemo(finishedId);
        } finally {
          this.isTransitioning = false;
        }
      }, 4000);
      return;
    }

    // Первый запуск
    await this.launchNextDemo();
  }

  private async launchNextDemo(prevGameId?: number): Promise<void> {
    try {
      const bots = await prisma.user.findMany({
        where: { isBot: true },
      });
      if (bots.length < 4) return;

      // Выбираем 4 случайных ботов из всех доступных персоналий
      const shuffled = bots.slice().sort(() => Math.random() - 0.5);
      const chosen = shuffled.slice(0, 4);

      // Выбор формата партии для полного покрытия матрицы «12 Уровней x 12 Персон»:
      // 1. Турнирный разрядный стол (40%): последовательно циклирует все 12 уровней (1..12) без пропусков
      // 2. Контрастный дуэт «Мастер + Ученик» (30%): опытный (Ур. 7..12) + начинающий (Ур. 1..6)
      // 3. Смежные разряды (20%): пара соседних уровней силы
      // 4. Свободная калибровка (10%): случайный разброс разрядов для проверки неожиданных связок
      const roll = Math.random();
      let ratings: number[];

      if (roll < 0.40) {
        // Гарантированная ротация всех 12 уровней от Новичка (600) до Гроссмейстера (2500)
        const targetLevel = (this.levelRotationIndex++ % 12) + 1;
        const nominal = levelToElo(targetLevel);
        ratings = [0, 1, 2, 3].map(() => {
          const jitter = Math.floor(Math.random() * 70 - 35);
          return Math.max(500, Math.min(2550, nominal + jitter));
        });
      } else if (roll < 0.70) {
        // Контрастный дуэт: мастер (Ур. 7..12) + ученик (Ур. 1..6)
        const highLevel = Math.floor(7 + Math.random() * 6); // 7..12
        const lowLevel = Math.floor(1 + Math.random() * 6);  // 1..6
        const highA = Math.max(500, Math.min(2550, levelToElo(highLevel) + Math.floor(Math.random() * 60 - 30)));
        const lowA = Math.max(500, Math.min(2550, levelToElo(lowLevel) + Math.floor(Math.random() * 60 - 30)));
        const highB = Math.max(500, Math.min(2550, highA + Math.floor(Math.random() * 50 - 25)));
        const lowB = Math.max(500, Math.min(2550, lowA + (highA - highB)));
        ratings = [highA, lowA, highB, lowB];
      } else if (roll < 0.90) {
        // Смежные разряды: два соседних уровня
        const baseLevel = Math.floor(1 + Math.random() * 11); // 1..11
        const r1 = levelToElo(baseLevel);
        const r2 = levelToElo(baseLevel + 1);
        ratings = [
          r1 + Math.floor(Math.random() * 50 - 25),
          r2 + Math.floor(Math.random() * 50 - 25),
          r1 + Math.floor(Math.random() * 50 - 25),
          r2 + Math.floor(Math.random() * 50 - 25),
        ].map((r) => Math.max(500, Math.min(2550, r)));
      } else {
        // Свободный подбор
        ratings = [0, 1, 2, 3].map(() => {
          const lvl = Math.floor(1 + Math.random() * 12);
          return Math.max(500, Math.min(2550, levelToElo(lvl) + Math.floor(Math.random() * 60 - 30)));
        });
      }

      const members = chosen.map((b, idx) => {
        const rating = Math.max(500, ratings[idx]);
        return {
          uid: b.id,
          username: b.username,
          rating,
          isBot: true,
          botLevel: eloToLevel(rating),
        };
      });

      // Находим разбиение 4 ботов на 2 команды с минимальной разницей суммарного Elo
      const combos = [
        { t1: [members[0], members[1]], t2: [members[2], members[3]] },
        { t1: [members[0], members[2]], t2: [members[1], members[3]] },
        { t1: [members[0], members[3]], t2: [members[1], members[2]] },
      ];
      let best = combos[0];
      let minDiff = Infinity;
      for (const c of combos) {
        const sum1 = c.t1[0].rating + c.t1[1].rating;
        const sum2 = c.t2[0].rating + c.t2[1].rating;
        const diff = Math.abs(sum1 - sum2);
        if (diff < minDiff) {
          minDiff = diff;
          best = c;
        }
      }

      const team1 = Math.random() < 0.5 ? best.t1 : best.t2;
      const team2 = team1 === best.t1 ? best.t2 : best.t1;

      // Ротируем между фиксированными GameID 1 и 2
      const targetId: 1 | 2 = this.nextSlot;
      this.nextSlot = targetId === 1 ? 2 : 1;

      const gameId = await this.games!.createGame({
        mode: 'team',
        timeControl: { kind: 'none', baseMin: 0, incSec: 0 },
        team1,
        team2,
        isDemo: true,
        fixedId: targetId,
      });

      this.currentDemoGameId = gameId;

      if (prevGameId) {
        this.games!.broadcastNextDemo(prevGameId, gameId);
      }

      const avgElo = Math.round((team1[0].rating + team1[1].rating + team2[0].rating + team2[1].rating) / 4);
      console.log(`[demo] Запущена демонстрационная партия #${gameId} (in-memory TV, средний Elo: ${avgElo})`);
    } catch (e) {
      console.error('[demo] Ошибка старта демонстрационной партии:', e);
    }
  }
}

export const demoShowcase = new DemoShowcase();
