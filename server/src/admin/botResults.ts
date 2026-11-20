type BotOutcome = 'win' | 'loss' | 'draw';
type BotResult = {
  team: number;
  place: number | null;
  game: { status: string; result: string; reason: string | null };
};

/** Bot-seat outcome, not a unique game count. Unknown legacy results stay out
 * of the score denominator rather than being assumed to be draws. */
export function botOutcome({ team, place, game }: BotResult): BotOutcome | null {
  if (game.status !== 'finished') return null;
  switch (game.result) {
    case '1-0': return team === 1 ? 'win' : team === 2 ? 'loss' : null;
    case '0-1': return team === 2 ? 'win' : team === 1 ? 'loss' : null;
    case '1/2-1/2': return 'draw';
    case '*': return ['stalemate', 'material', 'repetition', 'fifty'].includes(game.reason ?? '') ? 'draw' : null;
    case 'ffa': return place === 1 ? 'win' : place !== null && place > 1 ? 'loss' : null;
    default: return null;
  }
}
