import { Chess } from 'chess.js';
import { getBotPersonality, type PieceType } from 'shared';

interface OpeningChoice {
  san: string;
  from: string;
  to: string;
  weight: number;
  promotion?: PieceType;
}

// Normalized FEN key: pieces + turn + castling (ignores en-passant and halfmove clock)
function normalizeFen(fen: string): string {
  const parts = fen.trim().split(/\s+/);
  return `${parts[0]} ${parts[1]} ${parts[2]}`;
}

// Opening tree database with major branches
const OPENING_BOOK: Record<string, OpeningChoice[]> = {
  // Initial position
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq': [
    { san: 'e4', from: 'e2', to: 'e4', weight: 48 },
    { san: 'd4', from: 'd2', to: 'd4', weight: 38 },
    { san: 'c4', from: 'c2', to: 'c4', weight: 9 },
    { san: 'Nf3', from: 'g1', to: 'f3', weight: 5 },
  ],

  // After 1. e4
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq': [
    { san: 'c5', from: 'c7', to: 'c5', weight: 42 }, // Sicilian
    { san: 'e5', from: 'e7', to: 'e5', weight: 32 }, // Open Game
    { san: 'e6', from: 'e7', to: 'e6', weight: 14 }, // French
    { san: 'c6', from: 'c7', to: 'c6', weight: 12 }, // Caro-Kann
  ],

  // After 1. e4 c5 (Sicilian)
  'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq': [
    { san: 'Nf3', from: 'g1', to: 'f3', weight: 70 },
    { san: 'Nc3', from: 'b1', to: 'c3', weight: 18 },
    { san: 'c3', from: 'c2', to: 'c3', weight: 12 },
  ],

  // After 1. e4 c5 2. Nf3 d6
  'rnbqkbnr/pp2pppp/3p4/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq': [
    { san: 'd4', from: 'd2', to: 'd4', weight: 80 },
    { san: 'Bb5+', from: 'f1', to: 'b5', weight: 20 },
  ],

  // After 1. e4 c5 2. Nf3 Nc6
  'r1bqkbnr/pp1ppppp/2n5/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq': [
    { san: 'd4', from: 'd2', to: 'd4', weight: 75 },
    { san: 'Bb5', from: 'f1', to: 'b5', weight: 25 },
  ],

  // After 1. e4 e5 (Open Game)
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq': [
    { san: 'Nf3', from: 'g1', to: 'f3', weight: 75 },
    { san: 'Bc4', from: 'f1', to: 'c4', weight: 12 },
    { san: 'f4', from: 'f2', to: 'f4', weight: 8 }, // King's Gambit
    { san: 'Nc3', from: 'b1', to: 'c3', weight: 5 }, // Vienna
  ],

  // After 1. e4 e5 2. Nf3 Nc6
  'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq': [
    { san: 'Bb5', from: 'f1', to: 'b5', weight: 48 }, // Ruy Lopez
    { san: 'Bc4', from: 'f1', to: 'c4', weight: 36 }, // Italian
    { san: 'd4', from: 'd2', to: 'd4', weight: 16 }, // Scotch
  ],

  // After 1. e4 e5 2. Nf3 Nc6 3. Bc4 (Italian)
  'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq': [
    { san: 'Bc5', from: 'f8', to: 'c5', weight: 60 }, // Giuoco Piano
    { san: 'Nf6', from: 'g8', to: 'f6', weight: 40 }, // Two Knights
  ],

  // After 1. e4 e6 (French)
  'rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq': [
    { san: 'd4', from: 'd2', to: 'd4', weight: 90 },
    { san: 'd3', from: 'd2', to: 'd3', weight: 10 },
  ],

  // After 1. e4 e6 2. d4 d5
  'rnbqkbnr/ppp2ppp/4p3/3p4/3PP3/8/PPP2PPP/RNBQKBNR w KQkq': [
    { san: 'Nc3', from: 'b1', to: 'c3', weight: 55 },
    { san: 'Nd2', from: 'b1', to: 'd2', weight: 25 },
    { san: 'e5', from: 'e4', to: 'e5', weight: 20 },
  ],

  // After 1. e4 c6 (Caro-Kann)
  'rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq': [
    { san: 'd4', from: 'd2', to: 'd4', weight: 88 },
    { san: 'Nc3', from: 'b1', to: 'c3', weight: 12 },
  ],

  // After 1. e4 c6 2. d4 d5
  'rnbqkbnr/pp2pppp/2p5/3p4/3PP3/8/PPP2PPP/RNBQKBNR w KQkq': [
    { san: 'Nc3', from: 'b1', to: 'c3', weight: 60 },
    { san: 'e5', from: 'e4', to: 'e5', weight: 30 },
    { san: 'exd5', from: 'e4', to: 'd5', weight: 10 },
  ],

  // After 1. d4 (Queen's Pawn)
  'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq': [
    { san: 'd5', from: 'd7', to: 'd5', weight: 46 }, // Closed
    { san: 'Nf6', from: 'g8', to: 'f6', weight: 44 }, // Indian Defenses
    { san: 'e6', from: 'e7', to: 'e6', weight: 10 },
  ],

  // After 1. d4 d5
  'rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq': [
    { san: 'c4', from: 'c2', to: 'c4', weight: 75 }, // Queen's Gambit
    { san: 'Nf3', from: 'g1', to: 'f3', weight: 15 },
    { san: 'Bf4', from: 'c1', to: 'f4', weight: 10 }, // London System
  ],

  // After 1. d4 d5 2. c4
  'rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq': [
    { san: 'e6', from: 'e7', to: 'e6', weight: 50 }, // QGD
    { san: 'c6', from: 'c7', to: 'c6', weight: 35 }, // Slav
    { san: 'dxc4', from: 'd5', to: 'c4', weight: 15 }, // QGA
  ],

  // After 1. d4 Nf6
  'rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq': [
    { san: 'c4', from: 'c2', to: 'c4', weight: 75 },
    { san: 'Nf3', from: 'g1', to: 'f3', weight: 15 },
    { san: 'Bf4', from: 'c1', to: 'f4', weight: 10 },
  ],

  // After 1. d4 Nf6 2. c4 e6
  'rnbqkb1r/pppp1ppp/4pn2/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq': [
    { san: 'Nc3', from: 'b1', to: 'c3', weight: 55 },
    { san: 'Nf3', from: 'g1', to: 'f3', weight: 35 },
    { san: 'g3', from: 'g2', to: 'g3', weight: 10 },
  ],

  // After 1. d4 Nf6 2. c4 g6
  'rnbqkb1r/pppppp1p/5np1/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq': [
    { san: 'Nc3', from: 'b1', to: 'c3', weight: 75 },
    { san: 'Nf3', from: 'g1', to: 'f3', weight: 25 },
  ],
};

export function getOpeningBookMove(
  fen: string,
  usernameOrId?: string,
): { from: string; to: string; promotion?: PieceType; san: string } | null {
  const norm = normalizeFen(fen);
  const choices = OPENING_BOOK[norm];
  if (!choices || choices.length === 0) return null;

  const personality = getBotPersonality(usernameOrId);
  const prefs = personality?.openingsPreference ?? [];

  const weightedChoices = choices.map((c) => {
    let weight = c.weight;
    // Boost weight if move matches personality preference
    for (const pref of prefs) {
      if (c.san === pref || c.san.startsWith(pref) || c.to === pref) {
        weight *= 3.5;
      }
    }
    return { ...c, weight };
  });

  const totalWeight = weightedChoices.reduce((acc, c) => acc + c.weight, 0);
  let randomVal = Math.random() * totalWeight;

  for (const c of weightedChoices) {
    randomVal -= c.weight;
    if (randomVal <= 0) {
      // Validate with chess.js
      const chess = new Chess(fen);
      const res = chess.move({ from: c.from, to: c.to, promotion: c.promotion });
      if (res) {
        return {
          from: c.from,
          to: c.to,
          promotion: c.promotion,
          san: res.san,
        };
      }
    }
  }

  // Fallback to first valid choice
  const chess = new Chess(fen);
  for (const c of choices) {
    const res = chess.move({ from: c.from, to: c.to, promotion: c.promotion });
    if (res) {
      return { from: c.from, to: c.to, promotion: c.promotion, san: res.san };
    }
  }

  return null;
}
