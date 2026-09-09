import { describe, expect, it } from 'vitest';
import { TeamGame } from '../src/game/teamGame.js';
import { clockOnMove, clockSnapshot, initClock } from '../src/game/clock.js';

describe('TeamGame', () => {
  it('стартовое состояние: ход белых, slot 0', () => {
    const tg = new TeamGame();
    expect(tg.turn()).toBe('w');
    expect(tg.currentSlot()).toBe(0);
  });

  it('чередование слотов внутри команды', () => {
    const tg = new TeamGame();
    // currentSlot() — слот стороны, которой сейчас ход.
    tg.applyMove('w', 0, 'e2', 'e4'); // белые slot0
    expect(tg.turn()).toBe('b');
    expect(tg.currentSlot()).toBe(0); // чёрные: их следующий ход — slot0
    tg.applyMove('b', 0, 'e7', 'e5'); // чёрные slot0
    expect(tg.currentSlot()).toBe(1); // белые: следующий ход — slot1
    tg.applyMove('w', 1, 'g1', 'f3'); // белые slot1
    expect(tg.currentSlot()).toBe(1); // чёрные: их следующий ход — slot1
    tg.applyMove('b', 1, 'b8', 'c6'); // чёрные slot1
    expect(tg.currentSlot()).toBe(0); // белые: снова slot0
    tg.applyMove('w', 0, 'f1', 'c4'); // белые slot0
    expect(tg.currentSlot()).toBe(0); // чёрные: снова slot0
    tg.applyMove('b', 0, 'a7', 'a6');
    expect(tg.currentSlot()).toBe(1); // белые: slot1
  });

  it('ход не в свою сторону/слот отклоняется', () => {
    const tg = new TeamGame();
    expect(() => tg.applyMove('b', 0, 'e7', 'e5')).toThrow('ход другой стороны');
    tg.applyMove('w', 0, 'e2', 'e4');
    // ход чёрных, но пробует slot1
    expect(() => tg.applyMove('b', 1, 'e7', 'e5')).toThrow('партнёра');
    // ход чёрных slot0 — ок
    tg.applyMove('b', 0, 'e7', 'e5');
    // белые пробуют slot1 — ок
    tg.applyMove('w', 1, 'g1', 'f3');
    // белые снова slot0? Нет — ход чёрных
    expect(() => tg.applyMove('w', 0, 'f1', 'c4')).toThrow('другой стороны');
  });

  it('нелегальный ход отклоняется', () => {
    const tg = new TeamGame();
    expect(() => tg.applyMove('w', 0, 'e2', 'e5')).toThrow();
  });

  it('мат завершает партию (fool\'s mate)', () => {
    const tg = new TeamGame();
    tg.applyMove('w', 0, 'f2', 'f3');
    tg.applyMove('b', 0, 'e7', 'e5');
    tg.applyMove('w', 1, 'g2', 'g4');
    tg.applyMove('b', 1, 'd8', 'h4');
    expect(tg.isCheckmate()).toBe(true);
  });
});

describe('Clock', () => {
  it('первый ход активирует часы соперника без списания', () => {
    const c = initClock(5 * 60_000, 0);
    const r = clockOnMove(c, 'w', 1000);
    expect(r.clock.active).toBe('b');
    expect(r.clock.blackMs).toBe(5 * 60_000);
    expect(r.clock.whiteMs).toBe(5 * 60_000);
  });

  it('ход списывает время у ходившего и добавляет инкремент', () => {
    let c = initClock(5 * 60_000, 3000);
    c = clockOnMove(c, 'w', 0).clock; // активированы для b
    // чёрные думали 10 секунд
    const r = clockOnMove(c, 'b', 10_000);
    expect(r.clock.blackMs).toBe(5 * 60_000 - 10_000 + 3000);
    expect(r.clock.active).toBe('w');
  });

  it('флаг: превышение времени фиксируется', () => {
    let c = initClock(3000, 0);
    c = clockOnMove(c, 'w', 0).clock; // ход b, t=0
    // чёрные «думали» 4 секунды при 3 доступных
    const r = clockOnMove(c, 'b', 4000);
    expect(r.flagged).toBe('b');
    expect(r.clock.blackMs).toBe(0);
  });

  it('премув / лагокомпенсация: ход до 100 мс списывает 0 мс', () => {
    let c = initClock(5 * 60_000, 2000);
    c = clockOnMove(c, 'w', 0).clock; // активен b, t=0
    // премув чёрных пришёл через 40 мс
    const r = clockOnMove(c, 'b', 40);
    // 0 мс списано, но инкремент 2000 мс начислен
    expect(r.clock.blackMs).toBe(5 * 60_000 + 2000);
    expect(r.flagged).toBeNull();
  });

  it('snapshot корректно показывает списание', () => {
    let c = initClock(60_000, 0);
    c = clockOnMove(c, 'w', 0).clock; // активен b
    c = clockOnMove(c, 'b', 0).clock; // активен w, срез t=0
    // белые думают: прошло 5 сек, срез на t=5000
    const s = clockSnapshot(c, 5000);
    expect(s.whiteMs).toBe(60_000 - 5000);
    expect(s.blackMs).toBe(60_000);
    expect(s.running).toBe(true);
  });
});
