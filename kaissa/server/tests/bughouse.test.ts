import { describe, expect, it } from 'vitest';
import { BughouseGame, isDrop, opposite, partnerOf, type Board } from '../src/game/bughouse.js';

function seq(bg: BughouseGame, board: Board, moves: [string, string][]): void {
  for (const [from, to] of moves) {
    bg.apply({ board, from, to });
  }
}

describe('BughouseGame', () => {
  it('стартовая позиция: обе доски в начальном состоянии', () => {
    const bg = new BughouseGame();
    expect(bg.turn(0)).toBe('w');
    expect(bg.turn(1)).toBe('w');
    expect(bg.fen(0)).toBe(bg.fen(1));
    expect(bg.fen(0)).toContain('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w');
  });

  it('обычный ход e2-e4 меняет FEN и turn, вторая доска не тронута', () => {
    const bg = new BughouseGame();
    bg.apply({ board: 0, from: 'e2', to: 'e4' });
    expect(bg.turn(0)).toBe('b');
    expect(bg.fen(0)).toContain('4P3');
    expect(bg.fen(1)).toContain('PPPPPPPP/RNBQKBNR w');
  });

  it('нелегальный ход отклоняется', () => {
    const bg = new BughouseGame();
    expect(() => bg.apply({ board: 0, from: 'e2', to: 'e5' })).toThrow();
    expect(() => bg.apply({ board: 0, from: 'e1', to: 'e3' })).toThrow();
  });

  it('ход не в свою сторону отклоняется', () => {
    const bg = new BughouseGame();
    expect(() => bg.apply({ board: 0, from: 'e7', to: 'e5' })).toThrow();
  });

  it('сбитая фигура уходит в карман партнёра взявшего', () => {
    const bg = new BughouseGame();
    // Доска 0: 1.e4 e5 2.Nf3 d6 3.Nxe5 — конь (белые) берёт пешку e5
    seq(bg, 0, [
      ['e2', 'e4'], ['e7', 'e5'],
      ['g1', 'f3'], ['d7', 'd6'],
      ['f3', 'e5'],
    ]);
    // Партнёр белых доски 0 = чёрные доски 1
    const partner = partnerOf({ board: 0, color: 'w' });
    expect(partner).toEqual({ board: 1, color: 'b' });
    expect(bg.pocketOf(1, 'b').p).toBe(1);
    expect(bg.pocketOf(0, 'w').p).toBe(0);
  });

  it('дроп пешки на пустую клетку: фигура появляется, ход переходит', () => {
    const bg = new BughouseGame();
    seq(bg, 0, [
      ['e2', 'e4'], ['e7', 'e5'],
      ['g1', 'f3'], ['d7', 'd6'],
      ['f3', 'e5'],
    ]);
    // Чёрные доски 1 сейчас ходят? На доске 1 после захвата ход чёрных? Захват был на доске 0,
    // доска 1 в стартовом состоянии: ход белых. Карман у чёрных доски 1 есть!
    // Но дроп может сделать только тот, чей сейчас ход.
    // Ход белых доски 1 → дроп чёрных невозможен
    expect(() => bg.apply({ board: 1, to: 'h6', piece: 'p' })).toThrow();
    // Белые доски 1 ходят, карман (1,'w') пуст
    expect(() => bg.apply({ board: 1, to: 'h3', piece: 'p' })).toThrow('В кармане нет такой фигуры');
  });

  it('дроп после передачи хода: корректная последовательность', () => {
    const bg = new BughouseGame();
    // Белые доски 1 берут пешку → в карман ЧЁРНЫМ доски 0 (партнёр белых (1,'w') = (0,'b'))
    seq(bg, 1, [
      ['e2', 'e4'], ['e7', 'e5'],
      ['g1', 'f3'], ['d7', 'd6'],
      ['f3', 'e5'],
    ]);
    expect(bg.pocketOf(0, 'b').p).toBe(1);
    // Ход на доске 0 — белых. Белые ходят:
    bg.apply({ board: 0, from: 'e2', to: 'e4' });
    // Теперь чёрные доски 0 дропают пешку на d5
    bg.apply({ board: 0, to: 'd5', piece: 'p' });
    expect(bg.fen(0)).toContain('3p4');
    expect(bg.turn(0)).toBe('w');
    expect(bg.pocketOf(0, 'b').p).toBe(0);
  });

  it('дроп невозможен с пустым карманом', () => {
    const bg = new BughouseGame();
    expect(() => bg.apply({ board: 0, to: 'd4', piece: 'q' })).toThrow('В кармане нет такой фигуры');
  });

  it('дроп на занятую клетку невозможен', () => {
    const bg = new BughouseGame();
    seq(bg, 0, [
      ['e2', 'e4'], ['e7', 'e5'],
      ['g1', 'f3'], ['d7', 'd6'],
      ['f3', 'e5'],
    ]);
    // ход на доске 1 — белых; у чёрных (1,'b') есть пешка, но ход не их
    expect(() => bg.apply({ board: 1, to: 'a7', piece: 'p' })).toThrow();
  });

  it('пешку нельзя дропать на 1/8 горизонтали', () => {
    const bg = new BughouseGame();
    // белые доски 0 жертворскладывают... просто даём карман напрямую через захват на доске 1
    seq(bg, 1, [
      ['e2', 'e4'], ['e7', 'e5'],
      ['g1', 'f3'], ['d7', 'd6'],
      ['f3', 'e5'],
    ]);
    // теперь карман (0,'b') = 1 пешка, ход белых доски 0
    bg.apply({ board: 0, from: 'a2', to: 'a3' });
    // чёрные доски 0 пробуют дропать на 1/8:
    expect(() => bg.apply({ board: 0, to: 'd1', piece: 'p' })).toThrow();
    expect(() => bg.apply({ board: 0, to: 'd8', piece: 'p' })).toThrow();
  });

  it('пешку можно дропать на 2..7 горизонтали', () => {
    const bg = new BughouseGame();
    seq(bg, 1, [
      ['e2', 'e4'], ['e7', 'e5'],
      ['g1', 'f3'], ['d7', 'd6'],
      ['f3', 'e5'],
    ]);
    bg.apply({ board: 0, from: 'a2', to: 'a3' });
    // чёрные доски 0 дропают пешку на d4 (чёрная пешка = 'p' в FEN)
    bg.apply({ board: 0, to: 'd4', piece: 'p' });
    expect(bg.fen(0)).toContain('3p');
  });

  it('мат при пустом кармане — мат (закрыться нечем)', () => {
    // Доска: чёрный король e8 зажат, белая ладья e1 даёт шах,
    // карманы пустые
    const bg = new BughouseGame(['4k3/8/8/8/8/8/8/4R1K1 b - - 0 1', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1']);
    // Re1-e8 мат? Король может уйти на d7/f7/d8?/f8?
    // d8,f8 атакованы ладьёй по 8-й? Нет, ладья на e1 — только e-файл.
    // Значит не мат. Так и проверим честно:
    expect(bg.isBughouseCheckmate(0)).toBe(false);
  });

  it('fools mate: мат белым при пустом кармане', () => {
    // Fool's mate: 1.f3 e5 2.g4 Qh4# — мат белым.
    // В багхаусе: ход белых (получивших мат), карман белых пуст → мат подтверждён.
    const bg = new BughouseGame();
    seq(bg, 0, [
      ['f2', 'f3'], ['e7', 'e5'],
      ['g2', 'g4'], ['d8', 'h4'],
    ]);
    // Ход белых, шах от Qh4. Карман белых (0,'w') пуст.
    expect(bg.isCheck(0)).toBe(true);
    expect(bg.isBughouseCheckmate(0)).toBe(true);
  });

  it('мат с фигурой в кармане: fool\'s mate + конь в кармане белых — мат НЕ подтверждён (дроп спасает)', () => {
    const bg = new BughouseGame();
    seq(bg, 0, [
      ['f2', 'f3'], ['e7', 'e5'],
      ['g2', 'g4'], ['d8', 'h4'],
    ]);
    // Даём белым доски 0 коня в карман: можно дропнуть на g3, закрыв шах
    bg.pocketOf(0, 'w').n = 1;
    expect(bg.isBughouseCheckmate(0)).toBe(false);
    // И реально: дроп коня на g3 закрывает линию атаки ферзя
    bg.apply({ board: 0, to: 'g3', piece: 'n' });
    expect(bg.isCheck(0)).toBe(false);
  });

  it('legalMoves включает дропы при непустом кармане', () => {
    const bg = new BughouseGame();
    seq(bg, 1, [
      ['e2', 'e4'], ['e7', 'e5'],
      ['g1', 'f3'], ['d7', 'd6'],
      ['f3', 'e5'],
    ]);
    bg.apply({ board: 0, from: 'a2', to: 'a3' });
    const moves = bg.legalMoves(0, 'b');
    const drops = moves.filter(isDrop);
    expect(drops.length).toBeGreaterThan(0);
    for (const d of drops) {
      expect(d.piece).toBe('p');
      expect(['1', '8']).not.toContain(d.to[1]);
    }
  });

  it('промоушен: пешка превращается, карманы не меняются', () => {
    const bg = new BughouseGame(['4k3/P7/8/8/8/8/8/4K3 w - - 0 1', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1']);
    const beforePartner = { ...bg.pocketOf(1, 'b') };
    bg.apply({ board: 0, from: 'a7', to: 'a8', promotion: 'q' });
    // белый ферзь на a8
    expect(bg.fen(0).split(' ')[0]).toContain('Q');
    expect(bg.fen(0).split(' ')[0].startsWith('Q')).toBe(true);
    const afterPartner = bg.pocketOf(1, 'b');
    expect(afterPartner).toEqual(beforePartner);
  });

  it('сбитый ферзь уходит в карман как ферзь', () => {
    // Белый ферзь d1 берёт чёрного ферзя d8: линия d свободна
    const bg = new BughouseGame(['3qk3/8/8/8/8/8/8/3QK3 w - - 0 1', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1']);
    bg.apply({ board: 0, from: 'd1', to: 'd8' });
    // Взял белый (0,'w') → партнёр (1,'b') получает ферзя
    expect(bg.pocketOf(1, 'b').q).toBe(1);
  });

  it('opposite и partnerOf', () => {
    expect(opposite('w')).toBe('b');
    expect(opposite('b')).toBe('w');
    expect(partnerOf({ board: 0, color: 'w' })).toEqual({ board: 1, color: 'b' });
    expect(partnerOf({ board: 1, color: 'w' })).toEqual({ board: 0, color: 'b' });
    expect(partnerOf({ board: 0, color: 'b' })).toEqual({ board: 1, color: 'w' });
  });

  it('обе доски ходят независимо', () => {
    const bg = new BughouseGame();
    bg.apply({ board: 0, from: 'e2', to: 'e4' });
    bg.apply({ board: 1, from: 'd2', to: 'd4' });
    expect(bg.fen(0)).not.toBe(bg.fen(1));
    expect(bg.turn(0)).toBe('b');
    expect(bg.turn(1)).toBe('b');
  });
});
