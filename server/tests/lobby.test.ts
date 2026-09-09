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

  it('routes multiple players clicking rematch into the exact same lobby', async () => {
    const mgr = new LobbiesManager();
    const players = [
      { uid: 1, username: 'p1', rating: 1200, isBot: false },
      { uid: 2, username: 'p2', rating: 1250, isBot: false },
      { uid: 3, username: 'bot_novice', rating: 900, isBot: true, botLevel: 1 },
      { uid: 4, username: 'bot_amateur', rating: 1200, isBot: true, botLevel: 2 },
    ];
    const opts = {
      gameId: 42,
      mode: 'team' as const,
      timeControl: { kind: 'none' as const, baseMin: 0, incSec: 0 },
    };

    // Player 1 clicks rematch
    const res1 = await mgr.rematch(1, players, opts);
    expect(res1).not.toBeNull();
    const lobby1Id = res1!.lobbyId;

    // Player 2 clicks rematch for the same game
    const res2 = await mgr.rematch(2, players, opts);
    expect(res2).not.toBeNull();
    const lobby2Id = res2!.lobbyId;

    // Must be the EXACT SAME lobby ID!
    expect(lobby2Id).toBe(lobby1Id);

    const lobby = mgr.getById(lobby1Id);
    expect(lobby).toBeDefined();
    // Player 1, Player 2, and both bots should be in the lobby
    expect(lobby!.members.has(1)).toBe(true);
    expect(lobby!.members.has(2)).toBe(true);
    expect(lobby!.members.has(3)).toBe(true);
    expect(lobby!.members.has(4)).toBe(true);
    expect(lobby!.members.size).toBe(4);
  });

  it('caps manual team choice to 2 players and allows toggle off', () => {
    const mgr = new LobbiesManager();
    const lobby = new Lobby(
      {
        id: 'L_MANUAL',
        code: 'MANU01',
        name: 'Ручной стол',
        mode: 'team',
        timeControl: { kind: 'none', baseMin: 0, incSec: 0 },
        private: false,
        teamMode: 'manual',
      },
      { uid: 1, username: 'p1', rating: 1200, ready: true, host: true, joinedAt: Date.now() },
    );
    lobby.members.set(2, { uid: 2, username: 'p2', rating: 1200, ready: true, host: false, joinedAt: Date.now() });
    lobby.members.set(3, { uid: 3, username: 'p3', rating: 1200, ready: true, host: false, joinedAt: Date.now() });
    lobby.members.set(4, { uid: 4, username: 'p4', rating: 1200, ready: true, host: false, joinedAt: Date.now() });
    (mgr as any).lobbies.set(lobby.id, lobby);

    // Player 1 chooses Team 1
    mgr.setTeamChoice(lobby.id, 1, 1);
    expect(lobby.members.get(1)?.teamChoice).toBe(1);

    // Player 2 chooses Team 1
    mgr.setTeamChoice(lobby.id, 2, 1);
    expect(lobby.members.get(2)?.teamChoice).toBe(1);

    // Player 3 tries to choose Team 1 -> team is full (2/2), ignored
    mgr.setTeamChoice(lobby.id, 3, 1);
    expect(lobby.members.get(3)?.teamChoice).toBeUndefined();

    // Player 1 toggles off Team 1
    mgr.setTeamChoice(lobby.id, 1, 1);
    expect(lobby.members.get(1)?.teamChoice).toBeNull();

    // Now Player 3 can choose Team 1
    mgr.setTeamChoice(lobby.id, 3, 1);
    expect(lobby.members.get(3)?.teamChoice).toBe(1);
  });
});
