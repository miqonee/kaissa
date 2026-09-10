// server/src/ai/botStats.ts
// Легковесный in-memory сборщик результатов партий ИИ vs ИИ (демо и матчи ботов)
import { getBotPersonality, type BotPairMetric } from 'shared';

export interface BotCounterStats {
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  checkmateCount: number;
  timeoutCount: number;
  stalemateCount: number;
  totalMoves: number;
}

export interface BotPairRecord {
  pairKey: string;
  bot1Username: string;
  bot2Username: string;
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
}

function emptyCounter(): BotCounterStats {
  return {
    totalGames: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    checkmateCount: 0,
    timeoutCount: 0,
    stalemateCount: 0,
    totalMoves: 0,
  };
}

class BotStatsTracker {
  private statsByLevel = new Map<number, BotCounterStats>();
  private statsByUsername = new Map<string, BotCounterStats>();
  private statsByPair = new Map<string, BotPairRecord>();

  /**
   * Зафиксировать результат чисто ботовской партии
   */
  recordBotGame(
    participants: { username: string; botLevel?: number | null; team: 1 | 2 }[],
    result: string,
    reason: string | null,
    plyCount: number,
  ): void {
    const winnerTeam = result === '1-0' ? 1 : result === '0-1' ? 2 : 0;
    const isDraw = result === '1/2-1/2' || result === '*' || winnerTeam === 0;

    // 1. По уровням и по персоналиям (username)
    for (const p of participants) {
      const level = p.botLevel ?? 1;
      let levelStat = this.statsByLevel.get(level);
      if (!levelStat) {
        levelStat = emptyCounter();
        this.statsByLevel.set(level, levelStat);
      }

      let userStat = this.statsByUsername.get(p.username);
      if (!userStat) {
        userStat = emptyCounter();
        this.statsByUsername.set(p.username, userStat);
      }

      for (const stat of [levelStat, userStat]) {
        stat.totalGames += 1;
        stat.totalMoves += plyCount;
        if (isDraw) {
          stat.draws += 1;
        } else if (p.team === winnerTeam) {
          stat.wins += 1;
        } else {
          stat.losses += 1;
        }

        if (reason === 'checkmate') stat.checkmateCount += 1;
        else if (reason === 'timeout') stat.timeoutCount += 1;
        else if (reason === 'stalemate') stat.stalemateCount += 1;
      }
    }

    // 2. По парам ботов (дуэты в командах 1 и 2)
    const team1Bots = participants.filter((p) => p.team === 1);
    const team2Bots = participants.filter((p) => p.team === 2);

    this.recordTeamPair(team1Bots, isDraw ? 'draw' : (winnerTeam === 1 ? 'win' : 'loss'));
    this.recordTeamPair(team2Bots, isDraw ? 'draw' : (winnerTeam === 2 ? 'win' : 'loss'));
  }

  private recordTeamPair(teamBots: { username: string }[], outcome: 'win' | 'loss' | 'draw'): void {
    if (teamBots.length < 2) return;
    const [u1, u2] = [teamBots[0].username, teamBots[1].username].sort();
    const pairKey = `${u1}+${u2}`;
    let rec = this.statsByPair.get(pairKey);
    if (!rec) {
      rec = {
        pairKey,
        bot1Username: u1,
        bot2Username: u2,
        totalGames: 0,
        wins: 0,
        losses: 0,
        draws: 0,
      };
      this.statsByPair.set(pairKey, rec);
    }

    rec.totalGames += 1;
    if (outcome === 'win') rec.wins += 1;
    else if (outcome === 'loss') rec.losses += 1;
    else rec.draws += 1;
  }

  getStatsForLevel(level: number): BotCounterStats {
    return this.statsByLevel.get(level) || emptyCounter();
  }

  getStatsForUsername(username: string): BotCounterStats {
    return this.statsByUsername.get(username) || emptyCounter();
  }

  getAllPairMetrics(): BotPairMetric[] {
    const list: BotPairMetric[] = [];
    for (const p of this.statsByPair.values()) {
      const p1 = getBotPersonality(p.bot1Username);
      const p2 = getBotPersonality(p.bot2Username);
      const winRate = p.totalGames > 0 ? Math.round((p.wins / p.totalGames) * 100) : 0;
      list.push({
        pairKey: p.pairKey,
        bot1Name: p1?.name || p.bot1Username,
        bot1Badge: p1?.badge || 'Бот',
        bot2Name: p2?.name || p.bot2Username,
        bot2Badge: p2?.badge || 'Бот',
        totalGames: p.totalGames,
        wins: p.wins,
        losses: p.losses,
        draws: p.draws,
        winRate,
      });
    }
    return list;
  }

  getBestAndWorstPairs(): { best: BotPairMetric | null; worst: BotPairMetric | null } {
    const pairs = this.getAllPairMetrics().filter((p) => p.totalGames >= 1);
    if (!pairs.length) return { best: null, worst: null };

    // Сортировка по winRate убыванию, затем по totalGames
    const sorted = pairs.slice().sort((a, b) => b.winRate - a.winRate || b.totalGames - a.totalGames);
    const best = sorted[0] || null;

    // Худшая пара: с наименьшим винрейтом
    const worst = sorted.length > 1 ? sorted[sorted.length - 1] : null;
    return { best, worst };
  }
}

export const botStatsTracker = new BotStatsTracker();
