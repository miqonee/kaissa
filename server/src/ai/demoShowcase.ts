// server/src/ai/demoShowcase.ts
// Фоновая демо-витрина партий ботов на главной странице (in-memory TV с ID 1 и 2)
import { eloToLevel } from 'shared';
import { prisma } from '../prisma.js';
import type { GamesManager } from '../game/manager.js';

export async function cleanupPureBotGames(): Promise<void> {
  try {
    const botGames = await prisma.game.findMany({
      where: {
        participants: {
          some: {
            user: { isBot: true },
          },
        },
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

    const botUsers = await prisma.user.findMany({ where: { isBot: true }, select: { id: true } });
    if (botUsers.length > 0) {
      const botIds = botUsers.map((b) => b.id);
      await prisma.ratingHistory.deleteMany({ where: { userId: { in: botIds } } });
      await prisma.user.updateMany({
        where: { isBot: true },
        data: { wins: 0, losses: 0, draws: 0 },
      });
      console.log(`[cleanup] Сброшена статистика для ${botUsers.length} ботов`);
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

      // Выбор формата партии: High-Elo (40%), Контрастный дуэт (35%), Клубный уровень (25%)
      const roll = Math.random();
      let ratings: number[];

      if (roll < 0.40) {
        // High-Elo стол гроссмейстеров (2100 - 2550 Elo, Ур. 10 - 12)
        const base = Math.floor(2150 + Math.random() * 350);
        ratings = [
          base + Math.floor(Math.random() * 80 - 40),
          base + Math.floor(Math.random() * 80 - 40),
          base + Math.floor(Math.random() * 80 - 40),
          base + Math.floor(Math.random() * 80 - 40),
        ];
      } else if (roll < 0.75) {
        // Контрастный дуэт: мастер (1950 - 2350) + любитель (750 - 1100)
        const highA = Math.floor(2000 + Math.random() * 300);
        const lowA = Math.floor(800 + Math.random() * 250);
        const highB = highA + Math.floor(Math.random() * 60 - 30);
        const lowB = lowA + (highA - highB);
        ratings = [highA, lowA, highB, lowB];
      } else {
        // Клубный уровень (1150 - 1500 Elo, Ур. 4 - 6)
        const base = Math.floor(1200 + Math.random() * 250);
        ratings = [
          base + Math.floor(Math.random() * 100 - 50),
          base + Math.floor(Math.random() * 100 - 50),
          base + Math.floor(Math.random() * 100 - 50),
          base + Math.floor(Math.random() * 100 - 50),
        ];
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
