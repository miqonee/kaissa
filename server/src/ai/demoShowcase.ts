// server/src/ai/demoShowcase.ts
// Фоновая демо-витрина партий ботов на главной странице
import { prisma } from '../prisma.js';
import type { GamesManager } from '../game/manager.js';

export class DemoShowcase {
  private games: GamesManager | null = null;
  private currentDemoGameId: number | null = null;
  private checkInterval: NodeJS.Timeout | null = null;
  private running = false;

  start(games: GamesManager): void {
    this.games = games;
    this.running = true;
    if (!this.checkInterval) {
      this.checkInterval = setInterval(() => void this.tick(), 3000);
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
    if (!this.running || !this.games) return;

    if (this.currentDemoGameId) {
      const active = this.games.getActive(this.currentDemoGameId);
      if (active && active.status === 'active') {
        return; // партия ещё идёт
      }
      this.currentDemoGameId = null;
    }

    // Запускаем новую демо-партию
    await this.launchNextDemo();
  }

  private async launchNextDemo(): Promise<void> {
    try {
      const bots = await prisma.user.findMany({
        where: { isBot: true },
      });
      if (bots.length < 4) return;

      // Выбираем 4 случайных ботов
      const shuffled = bots.slice().sort(() => Math.random() - 0.5);
      const chosen = shuffled.slice(0, 4);

      const team1 = [
        { uid: chosen[0].id, username: chosen[0].username, rating: chosen[0].rating, isBot: true, botLevel: chosen[0].botLevel },
        { uid: chosen[1].id, username: chosen[1].username, rating: chosen[1].rating, isBot: true, botLevel: chosen[1].botLevel },
      ];
      const team2 = [
        { uid: chosen[2].id, username: chosen[2].username, rating: chosen[2].rating, isBot: true, botLevel: chosen[2].botLevel },
        { uid: chosen[3].id, username: chosen[3].username, rating: chosen[3].rating, isBot: true, botLevel: chosen[3].botLevel },
      ];

      const gameId = await this.games!.createGame({
        mode: 'team',
        timeControl: { kind: 'none', baseMin: 0, incSec: 0 },
        team1,
        team2,
      });

      this.currentDemoGameId = gameId;
      console.log(`[demo] Запущена демонстрационная партия #${gameId} между ботами`);
    } catch (e) {
      console.error('[demo] Ошибка старта демонстрационной партии:', e);
    }
  }
}

export const demoShowcase = new DemoShowcase();
