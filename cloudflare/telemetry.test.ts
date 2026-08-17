import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import REGISTRATIONS from "./migrations/0001_registrations.sql?raw";
import BOARD from "./migrations/0002_board.sql?raw";
import ACCRUAL from "./migrations/0003_accrual.sql?raw";
import VIN_COLUMN from "./migrations/0004_vehicle_vin.sql?raw";
import { createWorker, type Env } from "./worker";
import { ingest, purgeLocations, LOCATION_RETENTION_DAYS } from "./lib/ingest";
import { parseRecord, parseFailed, vinChannel, vinChannelPattern } from "./lib/telemetry";
import model from "../data/model.json";

/**
 * From a record on the wire to a row in the ledger.
 *
 * The receiver has been live and trusted by Tesla's own check since 2026-08-17
 * and has never had a consumer, so nothing between "a car sent this" and "this
 * member earned that" had ever run. This file is where that path is exercised,
 * and it is deliberately built out of the two artefacts that ship: the migration
 * files themselves and `data/model.json`.
 *
 * The interesting half is not that a kilometre pays ten DRV. It is that the
 * things which will actually happen — a redelivered frame, a batch sent twice
 * after a timeout, a number that arrives as a string, a car nobody linked — end
 * in a counted refusal rather than in a balance that is quietly wrong.
 */

const E = env as unknown as Env;
const { given } = model;
const ORIGIN = { origin: "https://teslam.io" };

/** Comments first, then whitespace, or a `--` line folds onto the next statement. */
function statements(sql: string): string[] {
  return sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

async function reset() {
  for (const t of [
    "reading_locations",
    "drv_ledger",
    "odometer_readings",
    "vehicles",
    "post_votes",
    "comments",
    "posts",
    "sessions",
    "accounts",
    "registrations",
  ]) {
    await E.DB.exec(`DROP TABLE IF EXISTS ${t}`);
  }
  for (const sql of [REGISTRATIONS, BOARD, ACCRUAL, VIN_COLUMN]) {
    for (const s of statements(sql)) await E.DB.exec(s);
  }
}

const worker = createWorker();
const call = (req: Request) => worker.fetch(req, E);

/**
 * A confirmed account, made the way one is really made.
 *
 * `vehicles.account_id` is a foreign key into `accounts`, and `accounts` is a
 * foreign key into `registrations`. Seeding those directly would work and would
 * also quietly prove that the chain of ownership can be forged; going through
 * the endpoints keeps the test honest about where an account comes from.
 */
async function account(email: string): Promise<string> {
  const invited = await call(
    new Request("https://api.teslam.io/v1/genesis/invite", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer test-export-token",
        ...ORIGIN,
      },
      body: JSON.stringify({
        email,
        model: "Model 3",
        trim: "Long Range",
        region: "capital",
        kmBand: "1000_2000",
        consentTerms: true,
        consentPrivacy: true,
      }),
    }),
  );
  const { confirmUrl } = (await invited.json()) as { confirmUrl: string };
  await call(
    new Request(
      `https://api.teslam.io/v1/genesis/confirm?token=${new URL(confirmUrl).searchParams.get("token")}`,
      { headers: ORIGIN },
    ),
  );

  const row = await E.DB.prepare(
    `SELECT a.id AS id FROM accounts a
       JOIN registrations r ON r.id = a.registration_id
      WHERE r.email = ?1`,
  )
    .bind(email)
    .first<{ id: string }>();
  expect(row, "confirmation did not create an account").toBeTruthy();
  return row!.id;
}

/**
 * A linked car.
 *
 * Inserted rather than linked through an endpoint because no linking endpoint
 * exists yet — Tesla OAuth is the step this repository cannot take until an
 * application is registered. The row is exactly what that flow will write.
 */
async function vehicle(accountId: string, vin: string, id = `veh_${vin}`): Promise<string> {
  await E.DB.prepare(
    `INSERT INTO vehicles
       (id, account_id, tesla_vehicle_id, display_name, vin, linked_at, created_at)
     VALUES (?1, ?2, ?3, 'Model 3', ?4, ?5, ?5)`,
  )
    .bind(id, accountId, `tesla_${vin}`, vin, Date.now())
    .run();
  return id;
}

/* ── the wire format ──────────────────────────────────────────────────── */

const BASE = Date.UTC(2026, 7, 17, 1, 0, 0);
const iso = (ms: number) => new Date(ms).toISOString();

/** A record shaped exactly as `transmit_decoded_records: true` produces one. */
function record(
  vin: string,
  atMs: number,
  data: Array<Record<string, unknown>>,
  extra: Record<string, unknown> = {},
): string {
  return JSON.stringify({ data, createdAt: iso(atMs), vin, isResend: false, ...extra });
}

const odometer = (miles: number) => ({ key: "Odometer", value: { doubleValue: miles } });
const location = (latitude: number, longitude: number) => ({
  key: "Location",
  value: { locationValue: { latitude, longitude } },
});

describe("the channel a car publishes to", () => {
  /**
   * The braces are literal. Redis reads them as a cluster hash tag, and Tesla's
   * producer writes them with `%s_{%s}` — a consumer that subscribes to
   * `teslam_V_5YJ…` connects, reports healthy and receives nothing forever.
   */
  it("keeps the braces", () => {
    expect(vinChannel("teslam", "5YJ3E1EA")).toBe("teslam_V_{5YJ3E1EA}");
    expect(vinChannelPattern("teslam")).toBe("teslam_V_*");
  });
});

describe("reading a record", () => {
  it("converts the miles Tesla sends", () => {
    const r = parseRecord(record("VIN1", BASE, [odometer(100)]));
    if (parseFailed(r)) throw new Error(r.rejected);
    expect(r.odometerKm).toBeCloseTo(160.9344, 6);
    expect(r.recordedAt).toBe(BASE);
    expect(r.vin).toBe("VIN1");
  });

  /**
   * protojson encodes int64 as a string always, and Tesla's own record.go
   * carries a regex for values that reach it in scientific notation. Reading
   * only `doubleValue` would drop these with no error anywhere.
   */
  it("accepts a number that arrived as a string", () => {
    const plain = parseRecord(record("VIN1", BASE, [{ key: "Odometer", value: { stringValue: "100" } }]));
    const sci = parseRecord(
      record("VIN1", BASE, [{ key: "Odometer", value: { stringValue: "1.0e+02" } }]),
    );
    if (parseFailed(plain) || parseFailed(sci)) throw new Error("string values were refused");
    expect(plain.odometerKm).toBeCloseTo(160.9344, 6);
    expect(sci.odometerKm).toBeCloseTo(160.9344, 6);
  });

  it("accepts an int64, which protojson also sends as a string", () => {
    const r = parseRecord(record("VIN1", BASE, [{ key: "Odometer", value: { longValue: "100" } }]));
    if (parseFailed(r)) throw new Error(r.rejected);
    expect(r.odometerKm).toBeCloseTo(160.9344, 6);
  });

  /**
   * `Number("NaN")` is `NaN`, which is not greater than zero and would have
   * passed a naive check straight into the odometer column.
   */
  it("refuses NaN and Infinity, which are legal protojson for a double", () => {
    for (const bad of ["NaN", "Infinity", "-Infinity"]) {
      const r = parseRecord(record("VIN1", BASE, [{ key: "Odometer", value: { doubleValue: bad } }]));
      expect(r, `${bad} became a reading`).toEqual({ rejected: "nothing-usable" });
    }
  });

  /** `EmitUnpopulated` writes nulls rather than omitting fields. */
  it("survives a null value", () => {
    const r = parseRecord(record("VIN1", BASE, [{ key: "Odometer", value: null }]));
    expect(r).toEqual({ rejected: "nothing-usable" });
  });

  it("refuses a signal the car marked invalid", () => {
    const r = parseRecord(
      record("VIN1", BASE, [{ key: "Odometer", value: { invalid: true, doubleValue: 0 } }]),
    );
    expect(r).toEqual({ rejected: "nothing-usable" });
  });

  it("refuses malformed and unattributable records", () => {
    expect(parseRecord("{not json")).toEqual({ rejected: "not-json" });
    expect(parseRecord("[]")).toEqual({ rejected: "not-an-object" });
    expect(parseRecord(JSON.stringify({ data: [], createdAt: iso(BASE) }))).toEqual({
      rejected: "no-vin",
    });
    expect(parseRecord(JSON.stringify({ data: [], vin: "VIN1", createdAt: "soon" }))).toEqual({
      rejected: "no-timestamp",
    });
  });

  it("takes a coordinate only as a complete pair", () => {
    const whole = parseRecord(record("VIN1", BASE, [odometer(100), location(37.5, 127.0)]));
    if (parseFailed(whole)) throw new Error(whole.rejected);
    expect(whole.latitude).toBe(37.5);
    expect(whole.longitude).toBe(127.0);

    // Half a position is not half-usable. Stored, it would put a point in the
    // Yellow Sea.
    const half = parseRecord(
      record("VIN1", BASE, [odometer(100), { key: "Location", value: { locationValue: { latitude: 37.5 } } }]),
    );
    if (parseFailed(half)) throw new Error(half.rejected);
    expect(half.latitude).toBeUndefined();
    expect(half.longitude).toBeUndefined();
  });

  it("refuses a coordinate outside the globe rather than clamping it", () => {
    const r = parseRecord(record("VIN1", BASE, [odometer(100), location(91, 127)]));
    if (parseFailed(r)) throw new Error(r.rejected);
    expect(r.latitude).toBeUndefined();
  });

  it("ignores signals the model does not ask for", () => {
    const r = parseRecord(
      record("VIN1", BASE, [odometer(100), { key: "VehicleSpeed", value: { floatValue: 60 } }]),
    );
    if (parseFailed(r)) throw new Error(r.rejected);
    expect(r.odometerKm).toBeCloseTo(160.9344, 6);
  });
});

/* ── the ledger ───────────────────────────────────────────────────────── */

describe("writing to the ledger", () => {
  let acc: string;

  beforeEach(async () => {
    await reset();
    acc = await account("owner@example.com");
    await vehicle(acc, "VIN1");
  });

  const run = (raw: string[], collectLocation = false) =>
    ingest(E.DB, raw, { collectLocation, now: BASE });

  it("records a first reading and pays nothing for it", async () => {
    const report = await run([record("VIN1", BASE, [odometer(1000)])]);
    expect(report.readings).toBe(1);
    expect(report.accruals).toBe(0);
    expect(report.skipped["first-reading"]).toBe(1);
  });

  it("pays the model's rate for the interval between two readings", async () => {
    const report = await run([
      record("VIN1", BASE, [odometer(1000)]),
      record("VIN1", BASE + 30 * 60_000, [odometer(1010)]),
    ]);
    expect(report.readings).toBe(2);
    expect(report.accruals).toBe(1);
    // 10 miles = 16.09344 km, floored after multiplying by the model's rate.
    expect(report.drv).toBe(Math.floor(10 * 1.609344 * given.drvPerKm));
  });

  /**
   * Fleet Telemetry makes no ordering promise across a reconnect. Sorted, this
   * is one interval; unsorted, the later frame becomes the earlier one's
   * predecessor and both outcomes are wrong.
   */
  it("sorts by the vehicle's clock before writing", async () => {
    const report = await run([
      record("VIN1", BASE + 30 * 60_000, [odometer(1010)]),
      record("VIN1", BASE, [odometer(1000)]),
    ]);
    expect(report.readings).toBe(2);
    expect(report.accruals).toBe(1);
  });

  /**
   * The transport is pub/sub and the consumer will be restarted mid-flight, so
   * a batch arriving twice is not an edge case — it is the normal cost of a
   * timeout. This is the property that makes the retry free.
   */
  it("credits nothing extra when the same batch is sent twice", async () => {
    const batch = [
      record("VIN1", BASE, [odometer(1000)]),
      record("VIN1", BASE + 30 * 60_000, [odometer(1010)]),
    ];
    const first = await run(batch);
    const second = await run(batch);

    expect(second.readings).toBe(0);
    expect(second.accruals).toBe(0);
    expect(second.drv).toBe(0);
    expect(second.skipped.duplicate).toBe(2);

    const total = await E.DB.prepare(`SELECT COALESCE(SUM(drv), 0) AS t FROM drv_ledger`).first<{
      t: number;
    }>();
    expect(total!.t).toBe(first.drv);
  });

  it("refuses a frame Tesla redelivered after a disconnect", async () => {
    const frame = record("VIN1", BASE, [odometer(1000)]);
    await run([frame]);
    const again = await run([JSON.stringify({ ...JSON.parse(frame), isResend: true })]);
    expect(again.readings).toBe(0);
    expect(again.skipped.duplicate).toBe(1);
  });

  it("drops a record from a car nobody linked", async () => {
    const report = await run([record("STRANGER", BASE, [odometer(1000)])]);
    expect(report.readings).toBe(0);
    expect(report.skipped["unknown-vehicle"]).toBe(1);
  });

  it("stops accruing for a revoked car without losing its history", async () => {
    await run([
      record("VIN1", BASE, [odometer(1000)]),
      record("VIN1", BASE + 30 * 60_000, [odometer(1010)]),
    ]);
    await E.DB.prepare(`UPDATE vehicles SET revoked_at = ?1 WHERE vin = 'VIN1'`).bind(BASE).run();

    const after = await run([record("VIN1", BASE + 60 * 60_000, [odometer(1020)])]);
    expect(after.skipped["unknown-vehicle"]).toBe(1);

    const kept = await E.DB.prepare(`SELECT COUNT(*) AS n FROM drv_ledger`).first<{ n: number }>();
    expect(kept!.n).toBe(1);
  });

  /**
   * Found live, on the first end-to-end run through the real receiver, and it
   * is the worst kind of bug: silent, permanent, and invisible from the outside.
   *
   * A corrupt frame reported 1320 miles on a car that had done 1010. The
   * interval was correctly refused as `implausible-speed` — and the reading was
   * stored anyway, on the reasoning that a refusal to accrue is not a refusal to
   * record. It then became the baseline. Every subsequent genuine reading was
   * lower than it, so every one was refused as `not-increasing`. The vehicle
   * went on streaming, the consumer went on reporting success, and the member
   * never earned another DRV.
   */
  it("does not let a corrupt frame become the baseline", async () => {
    const corrupt = await run([
      record("VIN1", BASE, [odometer(1000)]),
      // 500 km in an hour: no car did that.
      record("VIN1", BASE + 60 * 60_000, [odometer(1000 + 500 / 1.609344)]),
    ]);
    expect(corrupt.readings).toBe(1);
    expect(corrupt.skipped["implausible-speed"]).toBe(1);

    // The reading that matters: an ordinary drive after the bad frame.
    const after = await run([record("VIN1", BASE + 90 * 60_000, [odometer(1010)])]);
    expect(after.accruals, "a genuine drive was refused after a corrupt frame").toBe(1);
    expect(after.drv).toBe(Math.floor(10 * 1.609344 * given.drvPerKm));
  });

  it("drops a reading that went backwards rather than recording it", async () => {
    await run([record("VIN1", BASE, [odometer(1000)])]);
    const back = await run([record("VIN1", BASE + 30 * 60_000, [odometer(990)])]);
    expect(back.readings).toBe(0);
    expect(back.skipped["not-increasing"]).toBe(1);

    const n = await E.DB.prepare(`SELECT COUNT(*) AS n FROM odometer_readings`).first<{
      n: number;
    }>();
    expect(n!.n).toBe(1);
  });

  /**
   * The other half of the same rule. These two refusals are about the interval,
   * not about the reading — the car barely moved, or it was away too long for
   * the distance between to be one trip — so the measurement is sound and has to
   * be kept, or the next genuine interval measures from a stale baseline and
   * pays for distance already counted.
   */
  it("keeps a reading refused for being below the odometer's resolution", async () => {
    const report = await run([
      record("VIN1", BASE, [odometer(1000)]),
      record("VIN1", BASE + 5 * 60_000, [odometer(1000.01)]),
    ]);
    expect(report.skipped["below-resolution"]).toBe(1);
    expect(report.readings).toBe(2);
  });

  it("keeps a reading refused for closing too long a silence", async () => {
    const report = await run([
      record("VIN1", BASE, [odometer(1000)]),
      record("VIN1", BASE + 30 * 24 * 60 * 60_000, [odometer(2000)]),
    ]);
    expect(report.skipped["gap-too-long"]).toBe(1);
    expect(report.readings).toBe(2);

    // And it is a usable baseline: the next drive accrues from it rather than
    // from the reading a month earlier.
    const next = await run([
      record("VIN1", BASE + 30 * 24 * 60 * 60_000 + 30 * 60_000, [odometer(2010)]),
    ]);
    expect(next.accruals).toBe(1);
    expect(next.drv).toBe(Math.floor(10 * 1.609344 * given.drvPerKm));
  });

  it("holds the daily cap across records in one batch", async () => {
    const perHop = 60; // miles
    const batch = [record("VIN1", BASE, [odometer(1000)])];
    for (let i = 1; i <= 12; i += 1) {
      batch.push(record("VIN1", BASE + i * 30 * 60_000, [odometer(1000 + i * perHop)]));
    }
    const report = await run(batch);
    expect(report.drv).toBe(given.dailyCapDrv);

    const day = await E.DB.prepare(
      `SELECT COALESCE(SUM(drv), 0) AS t FROM drv_ledger WHERE accrual_day = ?1`,
    )
      .bind("2026-08-17")
      .first<{ t: number }>();
    expect(day!.t).toBe(given.dailyCapDrv);
  });

  /** The cap is a promise made in a timezone, and the row records which day it was. */
  it("stamps the Seoul day on the ledger row", async () => {
    // 16:00 UTC on the 17th is already the 18th in Seoul.
    const evening = Date.UTC(2026, 7, 17, 16, 0, 0);
    await run([
      record("VIN1", evening, [odometer(1000)]),
      record("VIN1", evening + 30 * 60_000, [odometer(1010)]),
    ]);
    const row = await E.DB.prepare(`SELECT accrual_day FROM drv_ledger`).first<{
      accrual_day: string;
    }>();
    expect(row!.accrual_day).toBe("2026-08-18");
  });

  /**
   * Raised in review, and real. Tesla's documentation says a vehicle buffers
   * five thousand messages across a disconnect and delivers them on reconnect,
   * so a frame that belongs between two already-recorded readings arrives in a
   * later batch — where sorting within the batch cannot help it.
   *
   * The interval it falls inside has already been paid. Crediting it again is
   * not a rounding error: it is the ledger paying twice for one kilometre, which
   * `UNIQUE (vehicle_id, to_reading_id)` cannot catch because the destination
   * reading is a different one.
   */
  it("does not pay twice when a delayed frame lands inside a settled interval", async () => {
    const settled = await run([
      record("VIN1", BASE, [odometer(1000)]),
      record("VIN1", BASE + 60 * 60_000, [odometer(1020)]),
    ]);
    expect(settled.accruals).toBe(1);
    const paid = settled.drv;

    // The frame that was stuck in the car's buffer, for the midpoint.
    const late = await run([record("VIN1", BASE + 30 * 60_000, [odometer(1010)])]);
    expect(late.accruals, "a settled interval was credited a second time").toBe(0);
    expect(late.skipped["late-frame"]).toBe(1);
    // It is still recorded — it is a fact the car reported.
    expect(late.readings).toBe(1);

    const total = await E.DB.prepare(`SELECT COALESCE(SUM(drv),0) AS t FROM drv_ledger`).first<{
      t: number;
    }>();
    expect(total!.t).toBe(paid);
  });

  /**
   * Also from review. D1 has no interactive transactions, so the reading and the
   * ledger row used to be two awaits — and a Worker that died between them left
   * the reading committed with no interval. The retry saw the reading, called it
   * a duplicate, and that interval's DRV was gone permanently while every log
   * line said success.
   *
   * The orphan is created directly here because that is exactly the state the
   * failure leaves behind, and no sequence of records can produce it now.
   */
  it("repairs a reading whose ledger row never got written", async () => {
    await run([record("VIN1", BASE, [odometer(1000)])]);

    const at = BASE + 30 * 60_000;
    await E.DB.prepare(
      `INSERT INTO odometer_readings (id, vehicle_id, recorded_at, odometer_km, source, received_at)
       VALUES (?1, 'veh_VIN1', ?2, ?3, 'stream', ?2)`,
    )
      .bind(`veh_VIN1:${at}`, at, 1010 * 1.609344)
      .run();

    const orphaned = await E.DB.prepare(`SELECT COUNT(*) AS n FROM drv_ledger`).first<{ n: number }>();
    expect(orphaned!.n, "fixture did not create the orphan it is testing").toBe(0);

    const retry = await run([record("VIN1", at, [odometer(1010)])]);
    expect(retry.readings, "the reading was already there").toBe(0);
    expect(retry.accruals, "the lost interval was not repaired").toBe(1);
    expect(retry.drv).toBe(Math.floor(10 * 1.609344 * given.drvPerKm));
  });

  it("keeps two cars' odometers apart", async () => {
    await vehicle(acc, "VIN2");
    const report = await run([
      record("VIN1", BASE, [odometer(1000)]),
      record("VIN2", BASE, [odometer(50000)]),
      record("VIN1", BASE + 30 * 60_000, [odometer(1010)]),
      record("VIN2", BASE + 30 * 60_000, [odometer(50010)]),
    ]);
    expect(report.accruals).toBe(2);
    // If the odometers had been pooled, the cross-vehicle jump would have been
    // refused as implausible and this would be 0.
    expect(report.skipped["implausible-speed"]).toBeUndefined();
  });
});

/* ── coordinates ──────────────────────────────────────────────────────── */

describe("coordinates", () => {
  let acc: string;

  beforeEach(async () => {
    await reset();
    acc = await account("owner@example.com");
    await vehicle(acc, "VIN1");
  });

  const batch = () => [
    record("VIN1", BASE, [odometer(1000), location(37.5665, 126.978)]),
    record("VIN1", BASE + 30 * 60_000, [odometer(1010), location(37.4, 127.1)]),
  ];

  /**
   * The switch is the thing keeping `content/ko/legal.ts` true. If this test
   * ever passes with a row present, the site is telling readers something the
   * database contradicts.
   */
  it("stores nothing while collection is off, and still accrues", async () => {
    const report = await ingest(E.DB, batch(), { collectLocation: false, now: BASE });
    expect(report.accruals).toBe(1);
    expect(report.locations).toBe(0);

    const rows = await E.DB.prepare(`SELECT COUNT(*) AS n FROM reading_locations`).first<{
      n: number;
    }>();
    expect(rows!.n).toBe(0);
  });

  it("stores the pair when collection is on", async () => {
    const report = await ingest(E.DB, batch(), { collectLocation: true, now: BASE });
    expect(report.locations).toBe(2);

    const row = await E.DB.prepare(
      `SELECT latitude, longitude, expires_at FROM reading_locations ORDER BY expires_at LIMIT 1`,
    ).first<{ latitude: number; longitude: number; expires_at: number }>();
    expect(row!.latitude).toBeCloseTo(37.5665, 6);
    expect(row!.expires_at).toBe(BASE + LOCATION_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  });

  /**
   * A retention period nothing enforces is a sentence in a document. The expiry
   * is stamped at insert, so a later change of policy cannot reach back and
   * extend the life of coordinates collected under the old one.
   */
  it("is swept once its stamped expiry passes", async () => {
    await ingest(E.DB, batch(), { collectLocation: true, now: BASE });
    const expiry = BASE + LOCATION_RETENTION_DAYS * 24 * 60 * 60 * 1000;

    expect(await purgeLocations(E.DB, expiry - 1)).toBe(0);
    expect(await purgeLocations(E.DB, expiry)).toBe(2);
  });

  /** Deleting a coordinate must never disturb the balance that outlives it. */
  it("leaves the ledger untouched when coordinates are deleted", async () => {
    await ingest(E.DB, batch(), { collectLocation: true, now: BASE });
    const before = await E.DB.prepare(`SELECT SUM(drv) AS t FROM drv_ledger`).first<{ t: number }>();
    await purgeLocations(E.DB, Number.MAX_SAFE_INTEGER);
    const after = await E.DB.prepare(`SELECT SUM(drv) AS t FROM drv_ledger`).first<{ t: number }>();
    expect(after!.t).toBe(before!.t);
  });
});

/* ── the route ────────────────────────────────────────────────────────── */

describe("the ingest endpoint", () => {
  let acc: string;

  beforeEach(async () => {
    await reset();
    acc = await account("owner@example.com");
    await vehicle(acc, "VIN1");
  });

  const post = (body: unknown, token = "test-telemetry-token") =>
    new Request("https://api.teslam.io/v1/telemetry/ingest", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });

  it("refuses a caller without the token", async () => {
    const res = await call(post({ records: [] }, "wrong"));
    expect(res.status).toBe(401);
  });

  /**
   * The operator token reads registrations, addresses and all. It must not also
   * be able to write readings, because the two live on different machines.
   */
  it("does not accept the operator token", async () => {
    const res = await call(post({ records: [] }, "test-export-token"));
    expect(res.status).toBe(401);
  });

  it("writes what a car sent", async () => {
    const res = await call(
      post({
        records: [
          record("VIN1", BASE, [odometer(1000)]),
          record("VIN1", BASE + 30 * 60_000, [odometer(1010)]),
        ],
      }),
    );
    expect(res.status).toBe(200);
    const report = (await res.json()) as { readings: number; accruals: number; drv: number };
    expect(report.readings).toBe(2);
    expect(report.accruals).toBe(1);
    expect(report.drv).toBeGreaterThan(0);
  });

  it("counts a malformed entry rather than dropping it", async () => {
    const res = await call(post({ records: [record("VIN1", BASE, [odometer(1000)]), 42, "{oops"] }));
    const report = (await res.json()) as { received: number; skipped: Record<string, number> };
    expect(report.received).toBe(3);
    expect(report.skipped["not-json"]).toBe(2);
  });

  it("refuses a body that is not a batch", async () => {
    expect((await call(post({}))).status).toBe(400);
    expect((await call(post({ records: "no" }))).status).toBe(400);
  });

  it("refuses a batch above the ceiling", async () => {
    const res = await call(post({ records: new Array(501).fill(record("VIN1", BASE, [odometer(1)])) }));
    expect(res.status).toBe(413);
  });

  /** Machine to machine. A browser has no business reading this response. */
  it("returns no CORS header", async () => {
    const res = await call(post({ records: [] }));
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("honours the collection switch from configuration", async () => {
    const off = { ...E, COLLECT_LOCATION: "false" } as Env;
    await worker.fetch(
      post({ records: [record("VIN1", BASE, [odometer(1000), location(37.5, 127)])] }),
      off,
    );
    const rows = await E.DB.prepare(`SELECT COUNT(*) AS n FROM reading_locations`).first<{
      n: number;
    }>();
    expect(rows!.n).toBe(0);
  });
});
