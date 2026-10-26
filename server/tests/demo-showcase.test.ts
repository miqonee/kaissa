import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DemoShowcase } from "../src/ai/demoShowcase.js";
import { prisma } from "../src/prisma.js";
import type { GamesManager } from "../src/game/manager.js";
const bots = Array.from({ length: 4 }, (_, i) => ({
  id: i + 1,
  username: `bot_${i}`,
  rating: 1200,
}));
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
describe("Demo lifecycle", () => {
  it("does not launch overlapping demos while a database query is pending", async () => {
    let release!: (value: never) => void;
    vi.spyOn(prisma.user, "findMany").mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }) as never,
    );
    const createGame = vi.fn().mockResolvedValue(-1);
    const manager = { createGame, getActive: () => ({ status: "active" }) };
    const showcase = new DemoShowcase();
    showcase.start(manager as unknown as GamesManager);
    await vi.advanceTimersByTimeAsync(6000);
    expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
    release(bots as never);
    await vi.advanceTimersByTimeAsync(0);
    expect(createGame).toHaveBeenCalledTimes(1);
    showcase.stop();
  });
  it("does not start another game from a queued timer after stopping", async () => {
    vi.spyOn(prisma.user, "findMany").mockResolvedValue(bots as never);
    const createGame = vi.fn().mockResolvedValue(-1);
    const manager = { createGame, getActive: () => ({ status: "finished" }) };
    const showcase = new DemoShowcase();
    showcase.start(manager as unknown as GamesManager);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1500);
    showcase.stop();
    await vi.advanceTimersByTimeAsync(10000);
    expect(createGame).toHaveBeenCalledTimes(1);
  });
});
