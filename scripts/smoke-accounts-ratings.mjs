// Run only against a disposable local PostgreSQL database and a local test server.
// DATABASE_URL=... KAISSA_TEST_BASE_URL=http://127.0.0.1:4417 node --import tsx scripts/smoke-accounts-ratings.mjs
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { io } from "socket.io-client";
import {
  saveGameResult,
  loadPlayerRatings,
} from "../server/src/ratings/service.ts";
const dbUrl = new URL(process.env.DATABASE_URL ?? "http://invalid");
const base = process.env.KAISSA_TEST_BASE_URL ?? "";
assert(
  ["127.0.0.1", "localhost"].includes(dbUrl.hostname) &&
    /test/.test(dbUrl.pathname),
  "Use a dedicated LOCAL test database",
);
assert(
  /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base),
  "Use a local test server",
);
const db = new PrismaClient();
const prefix = `ux_${Date.now()}`;
const sockets = [];
async function request(path, body, cookie) {
  const res = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: res.status,
    body: await res.json(),
    cookie: res.headers.get("set-cookie")?.split(";")[0],
  };
}
async function connect(cookie) {
  const socket = io(base, {
    transports: ["websocket"],
    extraHeaders: { Cookie: cookie },
    reconnection: false,
  });
  sockets.push(socket);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Socket connect timeout")),
      5000,
    );
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once("connect_error", reject);
  });
  return socket;
}
try {
  const users = await Promise.all(
    [1, 2, 3, 4].map((i) =>
      db.user.create({
        data: { username: `${prefix}_${i}`, passwordHash: null },
      }),
    ),
  );
  const guest = await request("/api/auth/guest", {});
  assert.equal(guest.status, 201);
  assert.equal(guest.body.user.isGuest, true);
  const repeated = await request("/api/auth/guest", {}, guest.cookie);
  assert.equal(repeated.body.user.id, guest.body.user.id);
  const previous = await db.game.create({
    data: {
      mode: "crazyhouse",
      status: "finished",
      result: "1/2-1/2",
      reason: "repetition",
      ratingKind: "guest",
      participants: {
        create: [
          {
            userId: guest.body.user.id,
            team: 1,
            color: "w",
            boardIndex: 0,
            ratingBefore: 1200,
            ratingAfter: 1200,
            wasGuest: true,
          },
          {
            userId: users[0].id,
            team: 2,
            color: "b",
            boardIndex: 0,
            ratingBefore: 1200,
            ratingAfter: 1200,
          },
        ],
      },
    },
  });
  const oldSocket = await connect(guest.cookie);
  const disconnected = new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Old socket was not revoked")),
      5000,
    );
    oldSocket.once("disconnect", () => {
      clearTimeout(timer);
      resolve();
    });
  });
  const claims = await Promise.all(
    [1, 2].map(() =>
      request(
        "/api/auth/claim",
        { username: `${prefix}_claimed`, password: "local-test-password" },
        guest.cookie,
      ),
    ),
  );
  const claimed = claims.find((r) => r.status === 200);
  assert(claimed);
  assert.equal(claims.filter((r) => r.status === 200).length, 1);
  await disconnected;
  assert.equal(claimed.body.user.id, guest.body.user.id);
  assert.equal(claimed.body.user.isGuest, false);
  assert.equal(
    (await request("/api/auth/me", undefined, guest.cookie)).status,
    401,
  );
  assert.equal(
    (await request("/api/auth/me", undefined, claimed.cookie)).body.user.id,
    guest.body.user.id,
  );
  assert.equal(
    await db.gameParticipant.count({
      where: { gameId: previous.id, userId: guest.body.user.id },
    }),
    1,
  );
  const stale = await connect(guest.cookie);
  const denied = await stale.timeout(5000).emitWithAck("lobby:join", "invalid");
  assert.equal(denied.ok, false);
  console.log(
    "OK: guest reuse, concurrent claim, stable user ID, history preservation, old HTTP/socket sessions revoked",
  );

  const registered = await request("/api/auth/register", {
    username: `${prefix}_admin`,
    password: "local-test-password",
  });
  assert.equal(registered.status, 201);
  assert.equal(registered.body.user.isAdmin, false);
  const login = await request("/api/auth/login", {
    username: `${prefix}_claimed`,
    password: "local-test-password",
  });
  assert.equal(login.status, 200);
  await request("/api/auth/logout", {}, login.cookie);
  assert.equal(
    (await request("/api/auth/me", undefined, login.cookie)).status,
    401,
  );
  console.log(
    "OK: registration has no administrative privileges; login and logout validate session version",
  );

  async function game(mode = "team", kind = "rated", players = users) {
    const row = await db.game.create({
      data: {
        mode,
        ratingKind: kind,
        participants: {
          create: players.map((u, i) => ({
            userId: u.id,
            team: i < players.length / 2 ? 1 : 2,
            color: i < players.length / 2 ? "w" : "b",
            boardIndex: 0,
            moveSlot: i % 2,
            ratingBefore: 1200,
            wasGuest: !!u.isGuest,
          })),
        },
      },
    });
    return {
      ...row,
      participants: players.map((u, i) => ({
        uid: u.id,
        team: i < players.length / 2 ? 1 : 2,
        ratingBefore: 1200,
        ratingAfter: null,
        isGuest: !!u.isGuest,
        isBot: !!u.isBot,
      })),
    };
  }
  const rated = await game();
  await Promise.all([
    saveGameResult(rated, "1-0", "checkmate", 0),
    saveGameResult(rated, "1-0", "checkmate", 0),
  ]);
  assert.equal(
    await db.ratingHistory.count({ where: { gameId: rated.id } }),
    4,
  );
  const first = await db.modeRating.findUniqueOrThrow({
    where: { userId_mode: { userId: users[0].id, mode: "team" } },
  });
  assert.equal(first.rating, 1216);
  assert.equal(first.wins, 1);
  const prepared = await loadPlayerRatings(
    [{ uid: users[0].id, username: users[0].username, rating: 999 }],
    "team",
  );
  assert.equal(prepared[0].rating, 1216);
  const training = await game("bughouse", "bots");
  await saveGameResult(training, "0-1", "resign", 1);
  const practice = await db.modeRating.findUniqueOrThrow({
    where: { userId_mode: { userId: users[0].id, mode: "bughouse" } },
  });
  assert.equal(practice.rating, 1200);
  assert.equal(practice.losses, 0);
  assert.equal(practice.trainingLosses, 1);
  assert.equal(
    await db.ratingHistory.count({ where: { gameId: training.id } }),
    0,
  );
  const guestTraining = await game("crazyhouse", "guest", [
    { ...users[0], isGuest: true },
    users[1],
  ]);
  await saveGameResult(guestTraining, "1/2-1/2", "repetition", 0);
  const guestStats = await db.modeRating.findUniqueOrThrow({
    where: { userId_mode: { userId: users[0].id, mode: "crazyhouse" } },
  });
  assert.equal(guestStats.rating, 1200);
  assert.equal(guestStats.trainingDraws, 1);
  assert.equal(guestStats.draws, 0);
  console.log(
    "OK: mode-specific Elo, concurrent finalization once only, bot/guest training excluded from ratings",
  );

  const rollback = await game("crazyhouse-team");
  const broken = {
    ...rollback,
    participants: rollback.participants.map((p, i) =>
      i === 3 ? { ...p, uid: 2147483000 } : p,
    ),
  };
  await assert.rejects(saveGameResult(broken, "1-0", "checkmate", 0));
  assert.equal(
    (await db.game.findUniqueOrThrow({ where: { id: rollback.id } })).status,
    "active",
  );
  assert.equal(
    await db.modeRating.count({
      where: {
        mode: "crazyhouse-team",
        userId: { in: users.map((u) => u.id) },
      },
    }),
    0,
  );
  assert.equal(
    await db.ratingHistory.count({ where: { gameId: rollback.id } }),
    0,
  );
  await saveGameResult(rollback, "1/2-1/2", "stalemate", 0);
  assert.equal(
    (await db.game.findUniqueOrThrow({ where: { id: rollback.id } })).result,
    "1/2-1/2",
  );
  console.log(
    "OK: failed finalization rolls back result, counters and rating history; retry succeeds",
  );

  const leaderboard = await request("/api/users/leaderboard?mode=team");
  assert(
    leaderboard.body.leaderboard.some(
      (r) => r.userId === users[0].id && r.rating === 1216 && r.provisional,
    ),
  );
  const profile = await request(
    `/api/users/${users[0].username}?mode=bughouse`,
  );
  assert.equal(profile.body.mode, "bughouse");
  assert.equal(profile.body.ratingHistory.length, 0);
  const archive = await request(
    `/api/games/archive?mode=team&player=${prefix}&kind=rated`,
  );
  assert.equal(archive.status, 200);
  assert(archive.body.games.some((g) => g.id === rated.id));
  assert(
    archive.body.games.every(
      (g) => g.mode === "team" && g.ratingKind === "rated",
    ),
  );
  const oldDraw = await db.game.create({
    data: {
      mode: "team",
      status: "finished",
      result: "*",
      reason: "repetition",
      participants: {
        create: [
          {
            userId: users[0].id,
            team: 1,
            color: "w",
            boardIndex: 0,
            ratingBefore: 1320,
            ratingAfter: 1316,
          },
        ],
      },
    },
  });
  const draws = await request(
    `/api/games/archive?result=draw&player=${users[0].username}`,
  );
  assert.equal(
    draws.body.games.find((g) => g.id === oldDraw.id)?.result,
    "1/2-1/2",
  );
  const oldRow = await db.game.findUniqueOrThrow({ where: { id: oldDraw.id } });
  assert.equal(oldRow.result, "*");
  console.log(
    "OK: public archive, mode/player/rating filters, leaderboard and profile; legacy draws normalized without rewriting history",
  );
} finally {
  for (const s of sockets) s.disconnect();
  await db.$disconnect();
  const { prisma } = await import("../server/src/prisma.ts");
  await prisma.$disconnect();
}
