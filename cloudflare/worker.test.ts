import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
// Inlined at build time. workerd has no filesystem, so the migration is
// bundled as text rather than read at runtime — which also means the tests run
// against the very file that ships to D1.
import SCHEMA from "./migrations/0001_registrations.sql?raw";
import { createWorker, type Env } from "./worker";
import { collectingMailer } from "./lib/mail";
import { SEATS } from "../lib/genesis";

/**
 * The registration API, exercised against a real D1 in workerd.
 *
 * The seat counter is the only true number on the front page. Everything below
 * is ultimately about protecting that: a seat is held by a confirmed mailbox
 * and by nothing else, no two people hold the same one, and nothing about a
 * registrant leaks through a public route.
 */

const E = env as unknown as Env;

/**
 * Applies the shipped migration to a fresh table.
 *
 * Comments are stripped line by line and only then are newlines collapsed —
 * doing it the other way round folds a `--` comment onto the statement that
 * follows and silently eats it, which is exactly the bug this helper had.
 */
async function reset() {
  await E.DB.exec("DROP TABLE IF EXISTS registrations");

  const sql = SCHEMA.split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");

  for (const stmt of sql.split(";")) {
    const s = stmt.replace(/\s+/g, " ").trim();
    if (s) await E.DB.exec(s);
  }
}

const VALID = {
  email: "owner@example.com",
  model: "Model 3",
  trim: "Long Range",
  region: "capital",
  kmBand: "1000_2000",
  consentTerms: true,
  consentPrivacy: true,
};

function post(body: unknown, ip = "1.2.3.4") {
  return new Request("https://api.teslam.io/v1/genesis/register", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": ip },
    body: JSON.stringify(body),
  });
}

const get = (path: string, init: RequestInit = {}) =>
  new Request(`https://api.teslam.io${path}`, init);

/** A fresh worker per test so the in-memory rate limiter starts empty. */
function worker() {
  const { mailer, sent } = collectingMailer();
  return { w: createWorker({ mailer }), sent };
}

/** Registers and confirms in one step, returning the placement. */
async function join(w: ReturnType<typeof createWorker>, sent: { text: string }[], email: string) {
  await w.fetch(post({ ...VALID, email }, email), E);
  const token = sent[sent.length - 1].text.match(/token=(\w+)/)![1];
  const res = await w.fetch(get(`/v1/genesis/confirm?token=${token}`), E);
  return (await res.json()) as { placement?: { kind: string; number: number } };
}

beforeEach(reset);

describe("registration", () => {
  it("accepts a complete form and sends exactly one mail", async () => {
    const { w, sent } = worker();
    const res = await w.fetch(post(VALID), E);

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "pending", mailSent: true });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("owner@example.com");
  });

  it("refuses a form with a field missing, naming the field", async () => {
    const { w } = worker();
    // A distinct address per case: invalid submissions spend rate-limit budget
    // by design, so reusing one address here would test the limiter instead.
    for (const [field, body] of [
      ["email", { ...VALID, email: "not-an-address" }],
      ["region", { ...VALID, region: "atlantis" }],
      ["kmBand", { ...VALID, kmBand: "lots" }],
      ["trim", { ...VALID, trim: "Plaid" }], // not a Model 3 trim
      ["consentTerms", { ...VALID, consentTerms: false }],
      ["consentPrivacy", { ...VALID, consentPrivacy: undefined }],
    ] as const) {
      const res = await w.fetch(post(body, `ip-${field}`), E);
      expect(res.status, `${field} should be rejected`).toBe(400);
      expect((await res.json()) as { fields: string[] }).toMatchObject({
        fields: expect.arrayContaining([field]),
      });
    }
  });

  it("treats addresses case-insensitively so one person cannot take two seats", async () => {
    const { w, sent } = worker();
    await join(w, sent, "Owner@Example.com");
    await w.fetch(post({ ...VALID, email: "owner@EXAMPLE.com" }, "9.9.9.9"), E);

    const stats = await (await w.fetch(get("/v1/genesis/stats"), E)).json();
    expect((stats as { taken: number }).taken).toBe(1);
  });

  it("stops a loop from one address", async () => {
    const { w } = worker();
    for (let i = 0; i < 5; i++) {
      const r = await w.fetch(post({ ...VALID, email: `a${i}@example.com` }), E);
      expect(r.status).toBe(200);
    }
    const sixth = await w.fetch(post({ ...VALID, email: "a5@example.com" }), E);
    expect(sixth.status).toBe(429);
  });
});

describe("confirmation and seats", () => {
  it("holds no seat until the mail is answered", async () => {
    const { w, sent } = worker();
    await w.fetch(post(VALID), E);

    const before = await (await w.fetch(get("/v1/genesis/stats"), E)).json();
    expect((before as { taken: number }).taken).toBe(0);

    const token = sent[0].text.match(/token=(\w+)/)![1];
    await w.fetch(get(`/v1/genesis/confirm?token=${token}`), E);

    const after = await (await w.fetch(get("/v1/genesis/stats"), E)).json();
    expect((after as { taken: number }).taken).toBe(1);
  });

  it("gives seat 1 to the first confirmed registrant", async () => {
    const { w, sent } = worker();
    const out = await join(w, sent, "first@example.com");
    expect(out.placement).toMatchObject({ kind: "seat", number: 1 });
  });

  it("burns the token — a link works once", async () => {
    const { w, sent } = worker();
    await w.fetch(post(VALID), E);
    const token = sent[0].text.match(/token=(\w+)/)![1];

    expect((await w.fetch(get(`/v1/genesis/confirm?token=${token}`), E)).status).toBe(200);
    expect((await w.fetch(get(`/v1/genesis/confirm?token=${token}`), E)).status).toBe(404);
  });

  it("rejects a token nobody was sent", async () => {
    const { w } = worker();
    const res = await w.fetch(get("/v1/genesis/confirm?token=deadbeef"), E);
    expect(res.status).toBe(404);
  });

  it("never gives two people the same seat, even confirming at once", async () => {
    const { w, sent } = worker();
    const tokens: string[] = [];
    for (let i = 0; i < 12; i++) {
      await w.fetch(post({ ...VALID, email: `r${i}@example.com` }, `ip-${i}`), E);
      tokens.push(sent[i].text.match(/token=(\w+)/)![1]);
    }

    const results = await Promise.all(
      tokens.map((t) => w.fetch(get(`/v1/genesis/confirm?token=${t}`), E).then((r) => r.json())),
    );
    const seats = results.map(
      (r) => (r as { placement: { number: number } }).placement.number,
    );

    expect(new Set(seats).size).toBe(12);
    expect([...seats].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 12 }, (_, i) => i + 1),
    );
  });

  it("fills a withdrawn seat rather than numbering past the cohort", async () => {
    const { w, sent } = worker();
    for (let i = 0; i < 3; i++) await join(w, sent, `r${i}@example.com`);

    // Someone at seat 2 withdraws; the policy says the record is deleted.
    await E.DB.prepare("DELETE FROM registrations WHERE seat_no = 2").run();

    const next = await join(w, sent, "later@example.com");
    expect(next.placement).toMatchObject({ kind: "seat", number: 2 });
  });

  it("moves to the waitlist once the cohort is full", async () => {
    const { w, sent } = worker();
    // Fill the cohort directly; registering 500 times through HTTP would test
    // the rate limiter, not the boundary.
    const t = Math.floor(Date.now() / 1000);
    for (let i = 1; i <= SEATS; i++) {
      await E.DB.prepare(
        `INSERT INTO registrations
           (id, seat_no, email, verified_at, model, trim, region, km_band,
            consent_terms, consent_privacy, consent_at, created_at)
         VALUES (?, ?, ?, ?, 'Model 3', 'RWD', 'capital', 'under_500', 1, 1, ?, ?)`,
      )
        .bind(`seed-${i}`, i, `seed${i}@example.com`, t, t, t)
        .run();
    }

    const out = await join(w, sent, "late@example.com");
    expect(out.placement).toMatchObject({ kind: "waitlist", number: SEATS + 1 });
  });
});

describe("what the public can see", () => {
  it("counts by region and lists recent seats without identifying anyone", async () => {
    const { w, sent } = worker();
    await join(w, sent, "a@example.com");
    await w.fetch(post({ ...VALID, email: "b@example.com", region: "jeju" }, "ip-b"), E);
    const token = sent[1].text.match(/token=(\w+)/)![1];
    await w.fetch(get(`/v1/genesis/confirm?token=${token}`), E);

    const res = await w.fetch(get("/v1/genesis/stats"), E);
    const body = await res.text();

    expect(JSON.parse(body)).toMatchObject({
      seats: SEATS,
      taken: 2,
      byRegion: expect.arrayContaining([
        { region: "capital", count: 1 },
        { region: "jeju", count: 1 },
      ]),
    });

    // The whole response, as a string. No address may appear anywhere in it.
    expect(body).not.toContain("@example.com");
    expect(body).not.toContain("token");
  });

  it("refuses the export without the operator's token", async () => {
    const { w } = worker();
    expect((await w.fetch(get("/v1/genesis/export"), E)).status).toBe(401);
    expect(
      (
        await w.fetch(
          get("/v1/genesis/export", { headers: { authorization: "Bearer wrong" } }),
          E,
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await w.fetch(
          get("/v1/genesis/export", {
            headers: { authorization: "Bearer test-export-token" },
          }),
          E,
        )
      ).status,
    ).toBe(200);
  });

  it("reflects no origin it was not told about", async () => {
    const { w } = worker();
    const allowed = await w.fetch(
      get("/v1/genesis/stats", { headers: { origin: "https://teslam.io" } }),
      E,
    );
    expect(allowed.headers.get("access-control-allow-origin")).toBe("https://teslam.io");

    const evil = await w.fetch(
      get("/v1/genesis/stats", { headers: { origin: "https://teslam.io.evil.test" } }),
      E,
    );
    expect(evil.headers.get("access-control-allow-origin")).toBeNull();
  });
});
