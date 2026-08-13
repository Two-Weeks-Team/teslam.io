import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createWorker, type Env } from "./worker";
import { collectingMailer } from "./lib/mail";
import SCHEMA from "./migrations/0001_registrations.sql?raw";

/**
 * The live board.
 *
 * What is being checked is not "does a WebSocket open" but the two promises the
 * front page makes with it: that the watcher count shown is the number of people
 * actually there, and that a seat taken anywhere appears everywhere without a
 * reload.
 */

const E = env as unknown as Env;

async function reset() {
  await E.DB.exec("DROP TABLE IF EXISTS registrations");
  const sql = SCHEMA.split("\n")
    .map((l) => l.replace(/--.*$/, ""))
    .join("\n");
  for (const stmt of sql.split(";")) {
    const s = stmt.replace(/\s+/g, " ").trim();
    if (s) await E.DB.exec(s);
  }
}

beforeEach(reset);

const VALID = {
  model: "Model 3",
  trim: "Long Range",
  region: "capital",
  kmBand: "1000_2000",
  consentTerms: true,
  consentPrivacy: true,
};

function worker() {
  const { mailer, sent } = collectingMailer();
  return { w: createWorker({ mailer }), sent };
}

/**
 * Every socket opened by a test, closed after it.
 *
 * There is one board — `idFromName("genesis")` — and it outlives a test, so a
 * socket left open is a watcher the next test did not open and cannot see. That
 * is not a test artefact to work around: it is the object behaving exactly as
 * it will in production, where the room is shared and long-lived.
 */
const open: WebSocket[] = [];

afterEach(async () => {
  for (const ws of open.splice(0)) {
    try {
      ws.close();
    } catch {
      // Already gone.
    }
  }
  await settle();
});

/** Opens a socket and collects what the server pushes. */
async function connect(w: ReturnType<typeof createWorker>) {
  const res = await w.fetch(
    new Request("https://api.teslam.io/v1/live", {
      headers: { upgrade: "websocket", origin: "https://teslam.io" },
    }),
    E,
  );
  expect(res.status).toBe(101);

  const ws = res.webSocket!;
  open.push(ws);
  const seen: Record<string, unknown>[] = [];
  ws.accept();
  ws.addEventListener("message", (e) => {
    seen.push(JSON.parse(String(e.data)));
  });
  return { ws, seen };
}

/** Lets queued socket events be delivered before asserting on them. */
const settle = () => new Promise((r) => setTimeout(r, 50));

describe("connecting", () => {
  it("greets a new watcher with the size of the room", async () => {
    const { w } = worker();
    const { seen } = await connect(w);
    await settle();

    expect(seen[0]).toEqual({ type: "hello", watching: 1 });
  });

  it("tells the people already watching that someone arrived", async () => {
    const { w } = worker();
    const first = await connect(w);
    await settle();
    first.seen.length = 0;

    await connect(w);
    await settle();

    expect(first.seen).toContainEqual({ type: "watching", watching: 2 });
  });

  it("counts down when a watcher leaves", async () => {
    const { w } = worker();
    const stayer = await connect(w);
    const leaver = await connect(w);
    await settle();
    stayer.seen.length = 0;

    leaver.ws.close();
    await settle();

    expect(stayer.seen).toContainEqual({ type: "watching", watching: 1 });
  });

  it("refuses an upgrade from a page it does not know", async () => {
    const { w } = worker();
    const res = await w.fetch(
      new Request("https://api.teslam.io/v1/live", {
        headers: { upgrade: "websocket", origin: "https://teslam.io.evil.test" },
      }),
      E,
    );
    expect(res.status).toBe(403);
  });

  it("answers a plain GET with 426 rather than hanging", async () => {
    const { w } = worker();
    const res = await w.fetch(new Request("https://api.teslam.io/v1/live"), E);
    expect(res.status).toBe(426);
  });
});

describe("a seat being taken", () => {
  it("reaches every watcher, with the region the map needs", async () => {
    const { w, sent } = worker();
    const a = await connect(w);
    const b = await connect(w);
    await settle();
    a.seen.length = 0;
    b.seen.length = 0;

    await w.fetch(
      new Request("https://api.teslam.io/v1/genesis/register", {
        method: "POST",
        headers: { "content-type": "application/json", "cf-connecting-ip": "1.1.1.1" },
        body: JSON.stringify({ ...VALID, email: "jeju@example.com", region: "jeju" }),
      }),
      E,
    );
    const token = sent[0].text.match(/token=(\w+)/)![1];
    await w.fetch(new Request(`https://api.teslam.io/v1/genesis/confirm?token=${token}`), E);
    await settle();

    const expected = {
      type: "seat.taken",
      seatNo: 1,
      region: "jeju",
      model: "Model 3",
      taken: 1,
    };
    expect(a.seen).toContainEqual(expected);
    expect(b.seen).toContainEqual(expected);
  });

  it("says nothing about who took it", async () => {
    const { w, sent } = worker();
    const watcher = await connect(w);
    await settle();

    await w.fetch(
      new Request("https://api.teslam.io/v1/genesis/register", {
        method: "POST",
        headers: { "content-type": "application/json", "cf-connecting-ip": "2.2.2.2" },
        body: JSON.stringify({ ...VALID, email: "private@example.com" }),
      }),
      E,
    );
    const token = sent[0].text.match(/token=(\w+)/)![1];
    await w.fetch(new Request(`https://api.teslam.io/v1/genesis/confirm?token=${token}`), E);
    await settle();

    const wire = JSON.stringify(watcher.seen);
    expect(wire).not.toContain("private@example.com");
    expect(wire).not.toContain(token);
  });

  it("still confirms the seat when nobody is watching", async () => {
    const { w, sent } = worker();
    await w.fetch(
      new Request("https://api.teslam.io/v1/genesis/register", {
        method: "POST",
        headers: { "content-type": "application/json", "cf-connecting-ip": "3.3.3.3" },
        body: JSON.stringify({ ...VALID, email: "alone@example.com" }),
      }),
      E,
    );
    const token = sent[0].text.match(/token=(\w+)/)![1];
    const res = await w.fetch(
      new Request(`https://api.teslam.io/v1/genesis/confirm?token=${token}`),
      E,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      placement: { kind: "seat", number: 1 },
    });
  });
});
