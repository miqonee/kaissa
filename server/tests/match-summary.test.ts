import { describe, it, expect } from "vitest";
import { normalizedResult, type GameSummary } from "shared";
import { matchOutcome, endReason } from "../../client/src/utils/match.js";
import { ratingKind } from "../src/ratings/service.js";
const base = {
  mode: "team",
  status: "finished",
  result: "*",
  reason: "repetition",
  participants: [],
} as unknown as GameSummary;
describe("Match explanations and eligibility", () => {
  it("reads old team draws without confusing abandoned games or guessing a winner", () => {
    expect(normalizedResult(base)).toBe("1/2-1/2");
    expect(matchOutcome(base)).toBe("Ничья");
    expect(
      matchOutcome({ ...base, result: "1/2-1/2", mode: "crazyhouse" }),
    ).toBe("Ничья");
    expect(matchOutcome({ ...base, status: "abandoned" })).toContain(
      "Не завершена",
    );
    expect(matchOutcome({ ...base, status: "active" })).toBe("Идёт партия");
  });
  it("preserves Bughouse stalemate loss and identifies the board", () => {
    const game = {
      ...base,
      mode: "bughouse",
      reason: "stalemate",
      result: "0-1",
      endBoardIndex: 1,
    } as GameSummary;
    expect(matchOutcome(game)).toBe("Победила команда 2");
    expect(endReason(game)).toContain("поражение");
    expect(endReason(game)).toContain("№2");
  });
  it("rates only registered humans facing humans, including mixed teams", () => {
    expect(ratingKind([{ team: 1 }, { team: 2 }])).toBe("rated");
    expect(
      ratingKind([
        { team: 1 },
        { team: 1, isBot: true },
        { team: 2 },
        { team: 2, isBot: true },
      ]),
    ).toBe("rated");
    expect(ratingKind([{ team: 1 }, { team: 2, isBot: true }])).toBe("bots");
    expect(ratingKind([{ team: 1, isGuest: true }, { team: 2 }])).toBe("guest");
  });
});
