import { describe, it, expect, vi } from 'vitest';
import { Lobby, LobbiesManager } from '../src/lobby/lobbies.js';

describe('Auto Lobby and Team Modes', () => {
  it('creates auto lobby with correct attributes', () => {
    const lobby = new Lobby(
      {
        id: 'AUTO_TEST',
        code: 'TEST01',
        name: 'Быстрый стол 2х2',
        mode: 'team',
        timeControl: { kind: 'clock', baseMin: 3, incSec: 0 },
        private: false,
        teamMode: 'auto',
      },
      {
        uid: 101,
        username: 'bot_novice',
        rating: 900,
        ready: true,
        host: true,
        joinedAt: Date.now(),
        isBot: true,
        botLevel: 1,
      },
    );
    lobby.isAuto = true;

    expect(lobby.isAuto).toBe(true);
    expect(lobby.teamMode).toBe('auto');
    expect(lobby.summary().isAuto).toBe(true);
    expect(lobby.summary().players[0].isBot).toBe(true);
  });

  it('displaces bot when human joins 4-bot auto lobby', () => {
    const mgr = new LobbiesManager();
    const lobby = new Lobby(
      {
        id: 'AUTO_1',
        code: 'A1B2C3',
        name: 'Быстрый стол 2х2',
        mode: 'team',
        timeControl: { kind: 'clock', baseMin: 3, incSec: 0 },
        private: false,
        teamMode: 'auto',
      },
      { uid: 1, username: 'b1', rating: 900, ready: true, host: true, joinedAt: Date.now(), isBot: true, botLevel: 1 },
    );
    lobby.isAuto = true;

    // Add 3 more bots
    lobby.members.set(2, { uid: 2, username: 'b2', rating: 1200, ready: true, host: false, joinedAt: Date.now(), isBot: true, botLevel: 2 });
    lobby.members.set(3, { uid: 3, username: 'b3', rating: 1450, ready: true, host: false, joinedAt: Date.now(), isBot: true, botLevel: 3 });
    lobby.members.set(4, { uid: 4, username: 'b4', rating: 1700, ready: true, host: false, joinedAt: Date.now(), isBot: true, botLevel: 4 });

    expect(lobby.members.size).toBe(4);

    // Human joins
    const res = mgr.join(lobby, { uid: 99, username: 'human1', rating: 1300, isBot: false });
    expect(res.ok).toBe(true);
    expect(lobby.members.size).toBe(4);
    expect(lobby.members.has(99)).toBe(true);
    // One bot was displaced
    const bots = [...lobby.members.values()].filter(m => m.isBot);
    expect(bots.length).toBe(3);
  });

  it('handles pause toggle correctly for 1 human vs 2 humans', () => {
    const mgr = new LobbiesManager();
    const lobby = new Lobby(
      {
        id: 'AUTO_PAUSE',
        code: 'PAUSE1',
        name: 'Быстрый стол 2х2',
        mode: 'team',
        timeControl: { kind: 'clock', baseMin: 3, incSec: 0 },
        private: false,
      },
      { uid: 1, username: 'h1', rating: 1200, ready: true, host: true, joinedAt: Date.now(), isBot: false },
    );
    lobby.isAuto = true;
    lobby.autoCountdown = 10;
    (mgr as any).lobbies.set(lobby.id, lobby);

    // 1 human: pauses immediately
    mgr.pauseToggle(lobby.id, 1);
    expect(lobby.isPaused).toBe(true);
    expect(lobby.pausedBy.has(1)).toBe(true);

    // Unpause
    mgr.pauseToggle(lobby.id, 1);
    expect(lobby.isPaused).toBe(false);

    // Add second human
    lobby.members.set(2, { uid: 2, username: 'h2', rating: 1300, ready: true, host: false, joinedAt: Date.now(), isBot: false });

    // H1 pauses -> not paused yet (needs 2/2)
    mgr.pauseToggle(lobby.id, 1);
    expect(lobby.isPaused).toBe(false);
    expect(lobby.pausedBy.size).toBe(1);

    // H2 pauses -> now 2/2 -> paused!
    mgr.pauseToggle(lobby.id, 2);
    expect(lobby.isPaused).toBe(true);
    expect(lobby.pausedBy.size).toBe(2);
  });
});
