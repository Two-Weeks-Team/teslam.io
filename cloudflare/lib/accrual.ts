/**
 * Turning odometer readings into DRV.
 *
 * The site's whole argument is one sentence — "두 시점의 차이만 쓰므로
 * 되감기가 불가능합니다" — and this is where it is either true or a slogan.
 *
 * The rules that matter are enforced in `0003_accrual.sql` rather than here,
 * because a constraint refuses a row whatever the caller believes and this file
 * can be redeployed with a mistake in it. What is left for code is the
 * arithmetic and the judgement about which readings are usable at all.
 *
 * Every constant comes from `data/model.json`. None are written twice.
 */

import model from "../../data/model.json";

const { given } = model;

/**
 * Tesla reports `Odometer` in miles. `data/model.json` accrues per kilometre.
 *
 * Converted once, on the way in, and stored in kilometres — a unit that
 * depends on which table you are reading is a bug waiting for its moment.
 */
export const MILES_TO_KM = 1.609344;
export const milesToKm = (miles: number) => miles * MILES_TO_KM;

/** Asia/Seoul, because the daily cap is a promise made in a timezone. */
const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * The local day a reading falls in, as `YYYY-MM-DD`.
 *
 * Stored on the ledger row rather than derived later: recomputing it from UTC
 * in a different timezone would move the boundary, and the boundary is what
 * the cap is about.
 */
export function accrualDay(atMs: number): string {
  return new Date(atMs + SEOUL_OFFSET_MS).toISOString().slice(0, 10);
}

export type Reading = {
  id: string;
  recordedAt: number;
  odometerKm: number;
};

/** Why a pair of readings produced nothing. Absence of a reason means it did. */
export type Rejection =
  | "not-increasing"
  | "implausible-speed"
  | "gap-too-long"
  | "below-resolution";

export type Accrual = {
  fromReadingId: string;
  toReadingId: string;
  deltaKm: number;
  drv: number;
  drvUncapped: number;
  accrualDay: string;
};

/**
 * The fastest a car can plausibly have travelled between two readings.
 *
 * Not a speed limit — a physics check. A Model S Plaid tops out around 320
 * km/h and nothing on a Korean road sustains it, so 350 leaves room for a
 * genuinely fast drive while refusing a jump that no car made. What this
 * actually catches is not speeding: it is a replaced instrument cluster, a
 * corrupted frame, or somebody's idea of an exploit.
 */
const MAX_PLAUSIBLE_KMH = 350;

/**
 * How long a gap may be and still be one interval.
 *
 * Beyond this the two readings are not the ends of a drive, they are the ends
 * of a silence — the car was off, or the stream was down, and the distance
 * between them was covered by trips nobody streamed. Crediting it would be
 * crediting a guess. Seven days: long enough to survive an outage, short
 * enough that a month of disconnection does not pay out at once.
 */
const MAX_GAP_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Below this, the reading has not moved.
 *
 * Tesla's default `minimum_delta` for `Odometer` is 0.1 mile, so anything
 * smaller is noise in the last digit rather than distance. Crediting it would
 * turn rounding into income.
 */
const MIN_DELTA_KM = 0.05;

/**
 * One interval, from the previous reading to this one.
 *
 * Returns a rejection rather than throwing, and rather than silently returning
 * zero: the caller writes the reason down, and a stream that is being refused
 * should be visible as refusals rather than as an absence of earnings.
 *
 * @param earnedToday DRV already credited to this vehicle on `accrualDay(to)`,
 *   which is what makes the cap a cap rather than a suggestion.
 */
export function accrue(
  from: Reading,
  to: Reading,
  earnedToday: number,
): Accrual | { rejected: Rejection } {
  const deltaKm = to.odometerKm - from.odometerKm;
  const elapsedMs = to.recordedAt - from.recordedAt;

  // An odometer that appears to go backwards is a replaced cluster or a bad
  // frame. Either way it is not distance somebody drove, and the schema would
  // refuse it anyway — this is the same rule stated where the reason fits.
  if (deltaKm <= 0) return { rejected: "not-increasing" };
  if (deltaKm < MIN_DELTA_KM) return { rejected: "below-resolution" };
  if (elapsedMs > MAX_GAP_MS) return { rejected: "gap-too-long" };

  // Guard the division as well as the speed: two frames stamped the same
  // millisecond would otherwise produce Infinity and pass a `<` comparison.
  if (elapsedMs <= 0) return { rejected: "implausible-speed" };
  const kmh = deltaKm / (elapsedMs / 3_600_000);
  if (kmh > MAX_PLAUSIBLE_KMH) return { rejected: "implausible-speed" };

  const drvUncapped = Math.floor(deltaKm * given.drvPerKm);
  const remaining = Math.max(0, given.dailyCapDrv - earnedToday);
  const drv = Math.min(drvUncapped, remaining);

  return {
    fromReadingId: from.id,
    toReadingId: to.id,
    deltaKm,
    drv,
    drvUncapped,
    accrualDay: accrualDay(to.recordedAt),
  };
}

/** Narrowing helper, so call sites read as prose rather than as `"rejected" in x`. */
export const wasRejected = (
  r: Accrual | { rejected: Rejection },
): r is { rejected: Rejection } => "rejected" in r;
