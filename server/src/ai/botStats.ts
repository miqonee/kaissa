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
  private statsByUsernameRating = new Map<string, Map<number, { games: number; wins: number; draws: number }>>();

  /**
   * Зафиксировать результат чисто ботовской партии
   */
  recordBotGame(
    participants: { username: string; ratingBefore?: number; botLevel?: number | null; team: 1 | 2 }[],
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

      let ratingMap = this.statsByUsernameRating.get(p.username);
      if (!ratingMap) {
        ratingMap = new Map();
        this.statsByUsernameRating.set(p.username, ratingMap);
      }
      const elo = p.ratingBefore || 1200;
      let rEntry = ratingMap.get(elo);
      if (!rEntry) {
        rEntry = { games: 0, wins: 0, draws: 0 };
        ratingMap.set(elo, rEntry);
      }
      rEntry.games += 1;
      if (isDraw) {
        rEntry.draws += 1;
      } else if (p.team === winnerTeam) {
        rEntry.wins += 1;
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

  getBestEloText(username: string, defaultElo: number): string {
    const ratingMap = this.statsByUsernameRating.get(username);
    if (!ratingMap || ratingMap.size === 0) {
      return `${defaultElo} (Номинал)`;
    }
    // Score = (победы + 0.5 * ничьи) / игры — ничья даёт пол-очка.
    const entries = [...ratingMap.entries()].map(([elo, stat]) => ({
      elo,
      games: stat.games,
      wins: stat.wins,
      winRate: stat.games ? Math.round(((stat.wins + 0.5 * stat.draws) / stat.games) * 100) : 0,
    }));

    const withScore = entries.filter((e) => e.winRate > 0);
    if (withScore.length > 0) {
      withScore.sort((a, b) => b.winRate - a.winRate || b.games - a.games);
      return `${withScore[0].elo} (${withScore[0].winRate}% очков)`;
    }

    const totalG = entries.reduce((s, e) => s + e.games, 0);
    const avgE = Math.round(entries.reduce((s, e) => s + e.elo * e.games, 0) / totalG);
    return `${avgE} (0% побед)`;
  }

  getAllPairMetrics(): BotPairMetric[] {
    const list: BotPairMetric[] = [];
    for (const p of this.statsByPair.values()) {
      const p1 = getBotPersonality(p.bot1Username);
      const p2 = getBotPersonality(p.bot2Username);
      if (!p1 || !p2) continue; // Игнорируем устаревших тестовых ботов
      // Score: ничья = пол-очка
      const winRate = p.totalGames > 0 ? Math.round(((p.wins + 0.5 * p.draws) / p.totalGames) * 100) : 0;
      list.push({
        pairKey: p.pairKey,
        bot1Name: p1.name,
        bot1Badge: p1.badge,
        bot2Name: p2.name,
        bot2Badge: p2.badge,
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

    // Лучшая пара — по очкам (ничья = 0.5), при наличии хотя бы очков!
    const pairsWithScore = pairs.filter((p) => p.winRate > 0);
    const sortedBest = pairsWithScore.sort((a, b) => b.winRate - a.winRate || b.totalGames - a.totalGames);
    const best = sortedBest[0] || null;

    // Худшая пара
    const sortedWorst = pairs.slice().sort((a, b) => a.winRate - b.winRate || b.totalGames - a.totalGames);
    const worst = sortedWorst.length > 0 && (!best || sortedWorst[0].pairKey !== best.pairKey) ? sortedWorst[0] : null;
    return { best, worst };
  }
}

export const botStatsTracker = new BotStatsTracker();
