import { Chess, type Square } from 'chess.js';
import type { GameMode } from 'shared';

// ============================================================
// Экспорт партий в PGN.
//
// team-режим  → обычный PGN (открывается в lichess «как есть»).
// bughouse    → две партии в одном файле, вариант Crazyhouse:
//               дропы записываются как P@h6 — lichess понимает такую
//               нотацию для crazyhouse-анализа каждой доски отдельно.
// ============================================================

export interface PgnMove {
  boardIndex: number;
  ply: number;
  from: string;
  to: string;
  promotion: string | null;
  dropPiece: string | null;
}

export interface PgnGame {
  id: number;
  mode: GameMode;
  result: string;
  reason: string | null;
  baseMin: number;
  incSec: number;
  noClock: boolean;
  startedAt: Date;
  endedAt: Date | null;
  participants: {
    username: string;
    team: number;
    color: string;
    boardIndex: number;
    moveSlot: number;
    ratingBefore: number;
  }[];
}

function tag(name: string, value: string): string {
  return `[${name} "${value.replace(/"/g, "'")}"]`;
}

function fmtDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}.${p(d.getUTCMonth() + 1)}.${p(d.getUTCDate())}`;
}

function fmtTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

/** Имена сторон: в team-режиме — оба партнёра через « / » */
function sideNames(g: PgnGame, boardIndex: number, color: 'w' | 'b'): string {
  const players = g.participants
    .filter((p) => p.boardIndex === boardIndex && p.color === color)
    .sort((a, b) => a.moveSlot - b.moveSlot);
  return players.map((p) => p.username).join(' / ') || '?';
}

function sideRating(g: PgnGame, boardIndex: number, color: 'w' | 'b'): string {
  const players = g.participants.filter((p) => p.boardIndex === boardIndex && p.color === color);
  if (!players.length) return '?';
  const avg = Math.round(players.reduce((s, p) => s + p.ratingBefore, 0) / players.length);
  return String(avg);
}

/** Результат с точки зрения конкретной доски */
function boardResult(g: PgnGame, boardIndex: number): string {
  if (g.result !== '1-0' && g.result !== '0-1') return '*';
  const winnerTeam = g.result === '1-0' ? 1 : 2;
  // какой цвет на этой доске принадлежит команде-победителю
  const whiteTeam = g.participants.find((p) => p.boardIndex === boardIndex && p.color === 'w')?.team;
  return whiteTeam === winnerTeam ? '1-0' : '0-1';
}

const REASON_RU: Record<string, string> = {
  checkmate: 'мат',
  resign: 'сдача',
  timeout: 'время истекло',
  stalemate: 'пат',
  abandoned: 'партия брошена',
};

/** Собрать PGN одной доски */
function boardPgn(g: PgnGame, boardIndex: number, moves: PgnMove[]): string {
  const chess = new Chess();
  const sanList: string[] = [];

  for (const mv of moves.filter((m) => m.boardIndex === boardIndex).sort((a, b) => a.ply - b.ply)) {
    if (mv.dropPiece) {
      // Дроп: chess.js его не умеет — ставим фигуру руками, SAN пишем как P@h6
      const color = chess.turn();
      chess.put({ type: mv.dropPiece as 'p', color }, mv.to as Square);
      const parts = chess.fen().split(' ');
      parts[1] = parts[1] === 'w' ? 'b' : 'w';
      parts[3] = '-';
      chess.load(parts.join(' '));
      sanList.push(`${mv.dropPiece.toUpperCase()}@${mv.to}`);
      continue;
    }
    try {
      const m = chess.move({
        from: mv.from as Square,
        to: mv.to as Square,
        ...(mv.promotion ? { promotion: mv.promotion as 'q' } : {}),
      });
      sanList.push(m.san);
    } catch {
      // если позиция разошлась — прекращаем, чтобы не портить файл
      break;
    }
  }

  const result = boardResult(g, boardIndex);
  const tags: string[] = [
    tag('Event', g.mode === 'bughouse' ? `Каисса, багхаус #${g.id} (доска ${boardIndex + 1})` : `Каисса, 2×2 #${g.id}`),
    tag('Site', 'Каисса'),
    tag('Date', fmtDate(g.startedAt)),
    tag('UTCDate', fmtDate(g.startedAt)),
    tag('UTCTime', fmtTime(g.startedAt)),
    tag('Round', '1'),
    tag('White', sideNames(g, boardIndex, 'w')),
    tag('Black', sideNames(g, boardIndex, 'b')),
    tag('WhiteElo', sideRating(g, boardIndex, 'w')),
    tag('BlackElo', sideRating(g, boardIndex, 'b')),
    tag('Result', result),
    tag('TimeControl', g.noClock ? '-' : `${g.baseMin * 60}+${g.incSec}`),
  ];
  if (g.mode === 'bughouse') tags.push(tag('Variant', 'Crazyhouse'));
  if (g.reason) tags.push(tag('Termination', REASON_RU[g.reason] ?? g.reason));

  // Тело: 1. e4 e5 2. Nf3 ...
  const body: string[] = [];
  for (let i = 0; i < sanList.length; i += 2) {
    const num = i / 2 + 1;
    body.push(`${num}. ${sanList[i]}${sanList[i + 1] ? ` ${sanList[i + 1]}` : ''}`);
  }
  const movetext = (body.join(' ') + ` ${result}`).trim();

  return `${tags.join('\n')}\n\n${movetext}\n`;
}

/** PGN всей встречи (для багхауса — две партии в файле) */
export function buildPgn(g: PgnGame, moves: PgnMove[]): string {
  if (g.mode === 'bughouse') {
    return `${boardPgn(g, 0, moves)}\n${boardPgn(g, 1, moves)}`;
  }
  return boardPgn(g, 0, moves);
}
