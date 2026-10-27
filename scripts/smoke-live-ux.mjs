import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import { io } from "socket.io-client";
const base = process.env.KAISSA_TEST_BASE_URL ?? "";
const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert(
  ["127.0.0.1", "localhost"].includes(url.hostname) &&
    /test/.test(url.pathname),
);
assert(/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base));
assert(process.env.JWT_SECRET);
const db = new PrismaClient();
const sockets = [];
const prefix = `live_${Date.now()}`;
async function api(path, body, cookie) {
  const r = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json();
  assert(r.ok, JSON.stringify(data));
  return { ...data, cookie: r.headers.get("set-cookie")?.split(";")[0] };
}
function event(s, name, timeout = 12000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      s.off(name, done);
      reject(new Error(`Timeout: ${name}`));
    }, timeout);
    function done(payload) {
      clearTimeout(timer);
      resolve(payload);
    }
    s.once(name, done);
  });
}
async function connect(cookie) {
  const s = io(base, {
    transports: ["websocket"],
    extraHeaders: { Cookie: cookie },
    reconnection: false,
    autoConnect: false,
  });
  sockets.push(s);
  const ready = event(s, "connect", 5000);
  s.connect();
  await ready;
  return s;
}
const ack = (s, name, ...args) => s.timeout(5000).emitWithAck(name, ...args);
try {
  const users = await Promise.all(
    [1, 2].map((i) =>
      db.user.create({
        data: { username: `${prefix}_${i}`, passwordHash: null },
      }),
    ),
  );
  const cookies = users.map(
    (u) =>
      `kaissa_token=${jwt.sign({ uid: u.id, username: u.username, sv: 0 }, process.env.JWT_SECRET, { expiresIn: "1h" })}`,
  );
  async function start(cookieA, cookieB) {
    const a = await connect(cookieA),
      b = await connect(cookieB);
    const { lobby, code } = await api(
      "/api/lobbies",
      {
        name: "UX integration",
        mode: "crazyhouse",
        timeControl: { kind: "none", baseMin: 0, incSec: 0 },
        private: true,
        teamMode: "manual",
      },
      cookieA,
    );
    assert.equal((await ack(a, "lobby:join", code)).data.lobby.id, lobby.id);
    assert.equal((await ack(b, "lobby:join", code)).ok, true);
    a.emit("lobby:set-team", 1);
    b.emit("lobby:set-team", 2);
    b.emit("lobby:ready", true);
    // Wait for server confirmation, not just the outgoing ready packet.
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Readiness timeout")),
        5000,
      );
      const onState = (state) => {
        if (state.players.every((p) => p.ready)) {
          clearTimeout(timer);
          b.off("lobby:state", onState);
          resolve();
        }
      };
      b.on("lobby:state", onState);
    });
    const began = event(a, "lobby:started");
    assert.equal((await ack(a, "lobby:start")).ok, true);
    const { gameId } = await began;
    return { a, b, gameId };
  }
  async function move(s, id, from, to) {
    const r = await ack(s, "game:move", {
      gameId: id,
      boardIndex: 0,
      from,
      to,
    });
    assert.equal(r.ok, true, r.error);
  }
  const first = await start(cookies[0], cookies[1]);
  await move(first.a, first.gameId, "f2", "f3");
  await move(first.b, first.gameId, "e7", "e5");
  first.a.disconnect();
  const resumed = await connect(cookies[0]);
  const sync = event(resumed, "game:state");
  resumed.emit("game:watch", first.gameId);
  assert.equal((await sync).gameId, first.gameId);
  await move(resumed, first.gameId, "g2", "g4");
  const ended = event(resumed, "game:end");
  await move(first.b, first.gameId, "d8", "h4");
  const result = await ended;
  assert.equal(result.result, "0-1");
  assert.equal(result.ratingKind, "rated");
  assert.equal(
    result.participants.find((p) => p.userId === users[1].id).ratingAfter,
    1216,
  );
  const rematch = await api(
    `/api/games/${first.gameId}/rematch`,
    {},
    cookies[0],
  );
  const next = await api(`/api/games/${first.gameId}/rematch`, {}, cookies[1]);
  assert.equal(next.lobbyId, rematch.lobbyId);
  console.log(
    `OK: invitation by code, ready/start, legal moves, reconnect, checkmate, Elo, shared rematch lobby (game ${first.gameId})`,
  );
  const guest = await api("/api/auth/guest", {});
  const second = await start(guest.cookie, cookies[1]);
  await move(second.a, second.gameId, "f2", "f3");
  await move(second.b, second.gameId, "e7", "e5");
  const claimed = await api(
    "/api/auth/claim",
    { username: `${prefix}_saved`, password: "local-test-password" },
    guest.cookie,
  );
  assert.equal(claimed.user.id, guest.user.id);
  const saved = await connect(claimed.cookie);
  const state = event(saved, "game:state");
  saved.emit("game:watch", second.gameId);
  const current = await state;
  assert.equal(current.ratingKind, "guest");
  assert.equal(
    current.participants.find((p) => p.userId === guest.user.id).username,
    claimed.user.username,
  );
  await move(saved, second.gameId, "g2", "g4");
  const finish = event(saved, "game:end");
  await move(second.b, second.gameId, "d8", "h4");
  const done = await finish;
  assert.equal(done.ratingKind, "guest");
  assert.equal(
    await db.ratingHistory.count({ where: { gameId: second.gameId } }),
    0,
  );
  const archived = await api(`/api/games/${second.gameId}`, undefined, claimed.cookie);
  assert.equal(
    archived.game.participants.find((p) => p.userId === guest.user.id).isGuest,
    true,
  );
  assert.equal(archived.moves.length, 4);
  console.log(
    `OK: claim during active match, session replacement, identity sync, preserved moves and guest-at-start training eligibility (game ${second.gameId})`,
  );
} finally {
  for (const s of sockets) s.disconnect();
  await db.$disconnect();
}
