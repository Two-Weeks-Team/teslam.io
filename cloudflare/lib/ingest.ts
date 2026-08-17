/**
 * Putting a streamed record into the ledger.
 *
 * This is the join between two things that already existed and had never met:
 * the receiver, which knows a VIN and an odometer, and `0003_accrual.sql`,
 * which knows an account and refuses to be told the same thing twice.
 *
 * The shape of the work is dictated by one property of the schema — a reading
 * closes exactly one accrual interval, forever, because of `UNIQUE (vehicle_id,
 * to_reading_id)`. That makes the whole path safe to retry, which matters more
 * here than anywhere else in the codebase: the transport is Redis pub/sub, the
 * consumer will be restarted, and batches will be sent twice. Every write below
 * is therefore idempotent by construction rather than by a check.
 *
 * Identifiers are derived, not random. `crypto.randomUUID()` would give a
 * retried batch a different primary key for the same reading, so the row would
 * be refused by the UNIQUE index — correct, but it would also leave the caller
 * unable to name the row that won. A derived id means a retry computes the
 * identical row and the collision is on the primary key, where it reads as
 * exactly what it is.
 */

import {
  accrue,
  accrualDay,
  wasRejected,
  type Reading,
  type Rejection,
} from "./accrual";
import { parseFailed, parseRecord, type ParseFailure, type Signal } from "./telemetry";

/**
 * How long a coordinate lives.
 *
 * Not a number this file gets to invent on its own: it has to be the number the
 * privacy policy states, and at the time of writing the policy says coordinates
 * are not collected at all. Ninety days is written here so that the column is
 * never NULL and a sweep can exist; whoever revises the policy sets the real
 * figure and changes this in the same commit.
 *
 * A reading outlives its coordinate on purpose. The reading is the basis of a
 * balance and has to live as long as the balance does; a coordinate is a
 * cross-check and should not.
 */
export const LOCATION_RETENTION_DAYS = 90;

/** Why one record produced no reading. */
export type SkipReason =
  | ParseFailure
  | "unknown-vehicle"
  | "revoked"
  | "no-odometer"
  | "duplicate"
  | "first-reading"
  | Rejection;

export type IngestReport = {
  /** Records handed in. */
  received: number;
  /** Readings written. */
  readings: number;
  /** Ledger rows written. */
  accruals: number;
  /** DRV credited by this batch, after the daily cap. */
  drv: number;
  /** Coordinates written. Zero unless collection is switched on. */
  locations: number;
  /** Everything that produced nothing, counted by reason. */
  skipped: Partial<Record<SkipReason, number>>;
};

type VehicleRow = { id: string; account_id: string };

const emptyReport = (received: number): IngestReport => ({
  received,
  readings: 0,
  accruals: 0,
  drv: 0,
  locations: 0,
  skipped: {},
});

/**
 * A reading's primary key, derived from what makes it unique anyway.
 *
 * `UNIQUE (vehicle_id, recorded_at)` already says these two identify a reading.
 * Deriving the id from them means a redelivered frame collides on the primary
 * key rather than being inserted beside its own twin under a fresh UUID.
 */
const readingId = (vehicleId: string, recordedAt: number) => `${vehicleId}:${recordedAt}`;

/** Likewise: the interval a reading closes is named after the reading that closes it. */
const ledgerId = (toReadingId: string) => `${toReadingId}:drv`;

export type IngestOptions = {
  /**
   * Whether to write coordinates.
   *
   * A switch rather than a code path that is deleted and restored, because the
   * decision that governs it is administrative — a 위치정보법 filing — and will
   * be made on a day when nobody wants to deploy a schema change to act on it.
   * Off in production until then; the path itself is exercised by the suite so
   * that turning it on is a configuration change and not a first run.
   */
  collectLocation: boolean;
  /** Injectable so tests can pin the received-at column and the expiry. */
  now?: number;
};

/**
 * Write a batch of raw records.
 *
 * Records are sorted by the vehicle's own clock before anything is written.
 * Fleet Telemetry makes no ordering promise across a reconnect, and an
 * out-of-order pair would accrue the wrong way round — the later reading would
 * become the "previous" one for the earlier, and the earlier would then be
 * refused as `not-increasing`. Sorting costs nothing and removes the class.
 */
export async function ingest(
  db: D1Database,
  raw: string[],
  options: IngestOptions,
): Promise<IngestReport> {
  const report = emptyReport(raw.length);
  const now = options.now ?? Date.now();

  const note = (reason: SkipReason) => {
    report.skipped[reason] = (report.skipped[reason] ?? 0) + 1;
  };

  const signals: Signal[] = [];
  for (const record of raw) {
    const parsed = parseRecord(record);
    if (parseFailed(parsed)) {
      note(parsed.rejected);
      continue;
    }
    signals.push(parsed);
  }

  signals.sort((a, b) => a.recordedAt - b.recordedAt);

  /** VIN → vehicle, resolved once per batch rather than once per record. */
  const vehicles = new Map<string, VehicleRow | null>();
  /** `vehicleId|day` → DRV already credited, so the cap holds across a batch. */
  const earned = new Map<string, number>();

  for (const signal of signals) {
    if (!vehicles.has(signal.vin)) {
      const row = await db
        .prepare(
          `SELECT id, account_id FROM vehicles
            WHERE vin = ?1 AND revoked_at IS NULL`,
        )
        .bind(signal.vin)
        .first<VehicleRow>();
      vehicles.set(signal.vin, row ?? null);
    }
    const vehicle = vehicles.get(signal.vin);

    // A record from a car nobody linked is not an error worth failing a batch
    // over — it is what the receiver does when a vehicle is de-authorised, or
    // when somebody points a test at production. Counted, dropped, and the
    // batch continues.
    if (!vehicle) {
      note("unknown-vehicle");
      continue;
    }

    // Location-only records are dropped rather than stored. A coordinate hangs
    // off a reading, and inventing a reading to hold one would put a row in
    // `odometer_readings` that no odometer produced.
    if (signal.odometerKm === undefined) {
      note("no-odometer");
      continue;
    }

    const id = readingId(vehicle.id, signal.recordedAt);

    // The interval starts at the newest reading *before* this one, which is not
    // necessarily the one written last: a late frame arriving after a gap has
    // been filled must measure from its true predecessor.
    //
    // Looked up *before* the insert, and that ordering is the whole point. See
    // `storable` below.
    const previous = await db
      .prepare(
        `SELECT id, recorded_at, odometer_km FROM odometer_readings
          WHERE vehicle_id = ?1 AND recorded_at < ?2
          ORDER BY recorded_at DESC LIMIT 1`,
      )
      .bind(vehicle.id, signal.recordedAt)
      .first<{ id: string; recorded_at: number; odometer_km: number }>();

    /** Write the reading down. Returns false when the replay guard refused it. */
    const store = async () => {
      const inserted = await db
        .prepare(
          `INSERT INTO odometer_readings
             (id, vehicle_id, recorded_at, odometer_km, source, received_at)
           VALUES (?1, ?2, ?3, ?4, 'stream', ?5)
           ON CONFLICT DO NOTHING`,
        )
        .bind(id, vehicle.id, signal.recordedAt, signal.odometerKm, now)
        .run();

      // `changes` is 0 when the conflict clause fired. That is the replay guard
      // doing its job, and it is the expected outcome for every record Tesla
      // resends after an unacknowledged disconnect.
      if ((inserted.meta?.changes ?? 0) === 0) return false;
      report.readings += 1;

      if (
        options.collectLocation &&
        signal.latitude !== undefined &&
        signal.longitude !== undefined
      ) {
        await db
          .prepare(
            `INSERT INTO reading_locations (reading_id, latitude, longitude, expires_at)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT DO NOTHING`,
          )
          .bind(
            id,
            signal.latitude,
            signal.longitude,
            now + LOCATION_RETENTION_DAYS * 24 * 60 * 60 * 1000,
          )
          .run();
        report.locations += 1;
      }
      return true;
    };

    // A car's first reading establishes a position and earns nothing. There is
    // no interval yet, and crediting distance from zero would pay a member for
    // every kilometre driven before they joined.
    if (!previous) {
      if (!(await store())) note("duplicate");
      else note("first-reading");
      continue;
    }

    const day = accrualDay(signal.recordedAt);
    const key = `${vehicle.id}|${day}`;
    if (!earned.has(key)) {
      const sum = await db
        .prepare(
          `SELECT COALESCE(SUM(drv), 0) AS total FROM drv_ledger
            WHERE vehicle_id = ?1 AND accrual_day = ?2`,
        )
        .bind(vehicle.id, day)
        .first<{ total: number }>();
      earned.set(key, sum?.total ?? 0);
    }

    const from: Reading = {
      id: previous.id,
      recordedAt: previous.recorded_at,
      odometerKm: previous.odometer_km,
    };
    const to: Reading = {
      id,
      recordedAt: signal.recordedAt,
      odometerKm: signal.odometerKm,
    };

    const result = accrue(from, to, earned.get(key) ?? 0);
    if (wasRejected(result)) {
      // Whether the reading is kept depends on *why* it earned nothing, and
      // getting this wrong froze a vehicle's earnings permanently in the first
      // live test of this path.
      //
      // `below-resolution` and `gap-too-long` are refusals about the interval.
      // The reading itself is a sound measurement — the car had simply barely
      // moved, or had been away too long for the distance between to be one
      // trip — and it must be kept, because it is the baseline the next genuine
      // interval measures from.
      //
      // `not-increasing` and `implausible-speed` are refusals about the reading.
      // It contradicts the record: an odometer cannot go backwards and no car
      // covered five hundred kilometres in an hour, so the frame is corrupt, or
      // the instrument cluster was replaced. Storing it anyway made it the
      // baseline, and every subsequent genuine reading was then lower than it —
      // rejected as `not-increasing`, forever. One bad frame ended a member's
      // accrual permanently, silently, with the vehicle still streaming.
      //
      // So a contradicting frame is dropped. It is not a fact about distance,
      // it is a fault report, and the count in `skipped` is where it belongs.
      if (result.rejected === "not-increasing" || result.rejected === "implausible-speed") {
        note(result.rejected);
        continue;
      }
      note((await store()) ? result.rejected : "duplicate");
      continue;
    }

    if (!(await store())) {
      note("duplicate");
      continue;
    }

    const ledger = await db
      .prepare(
        `INSERT INTO drv_ledger
           (id, vehicle_id, account_id, from_reading_id, to_reading_id,
            delta_km, drv, drv_uncapped, accrual_day, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
         ON CONFLICT DO NOTHING`,
      )
      .bind(
        ledgerId(id),
        vehicle.id,
        vehicle.account_id,
        result.fromReadingId,
        result.toReadingId,
        result.deltaKm,
        result.drv,
        result.drvUncapped,
        result.accrualDay,
        now,
      )
      .run();

    if ((ledger.meta?.changes ?? 0) === 0) {
      note("duplicate");
      continue;
    }

    report.accruals += 1;
    report.drv += result.drv;
    // Only the capped figure counts against the cap, and only after the row is
    // committed — a batch that credits 0 because the cap is full must not go on
    // subtracting from a budget it never spent.
    earned.set(key, (earned.get(key) ?? 0) + result.drv);
  }

  return report;
}

/**
 * Delete coordinates past their retention.
 *
 * The expiry is written onto the row at insert rather than computed by this
 * sweep, so a change of policy applies to rows written after it and does not
 * silently reach back and extend the life of coordinates collected under the
 * old promise.
 */
export async function purgeLocations(db: D1Database, now = Date.now()): Promise<number> {
  const result = await db
    .prepare(`DELETE FROM reading_locations WHERE expires_at <= ?1`)
    .bind(now)
    .run();
  return result.meta?.changes ?? 0;
}
