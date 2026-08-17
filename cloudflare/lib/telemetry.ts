/**
 * Reading what a car actually sent.
 *
 * The receiver on 193 hands Redis whatever Fleet Telemetry produced and the
 * consumer forwards it without looking inside. This file is the only place that
 * interprets it, which is deliberate: the consumer runs on a shared host and is
 * awkward to test, while this runs in workerd under vitest against the same D1
 * the ledger uses.
 *
 * The wire format is protojson — `protojson.MarshalOptions{UseEnumNumbers:
 * false, EmitUnpopulated: true}` in `telemetry/record.go`, reached because
 * `config.json` sets `transmit_decoded_records: true`. That gives a shape which
 * looks like ordinary JSON and is not:
 *
 *   { "data": [ { "key": "Odometer", "value": { "doubleValue": 12345.6 } } ],
 *     "createdAt": "2026-08-17T06:00:00Z", "vin": "5YJ3…", "isResend": false }
 *
 * Three things about it cost real work, and all three are silent when wrong:
 *
 *   **A number may arrive as a string.** protojson always encodes int64 as a
 *   string, and Tesla's own code carries a `scientificNotationFloatRegex` for
 *   values that reach it as text — so `"1.2345e+04"` is a documented case, not a
 *   defensive fantasy. Reading only `doubleValue` would drop those records with
 *   no error anywhere.
 *
 *   **`EmitUnpopulated` emits nulls, not absences.** An unset message field is
 *   `null` rather than missing, so `datum.value.doubleValue` on a datum with no
 *   value is a TypeError at runtime and a rejected batch in production.
 *
 *   **NaN and Infinity are strings.** A double that is not finite serialises as
 *   `"NaN"`, and `Number("NaN")` is `NaN`, which is not `> 0` and would sail
 *   past a naive check into an odometer column.
 *
 * Miles are converted here, once, using the same constant the ledger uses.
 */

import { milesToKm } from "./accrual";

/** One decoded record: a car, an instant, and whatever it reported. */
export type Signal = {
  vin: string;
  /** The vehicle's own timestamp, in milliseconds. */
  recordedAt: number;
  /** Converted from the miles Tesla sends. Absent if the record had none. */
  odometerKm?: number;
  latitude?: number;
  longitude?: number;
  /**
   * Tesla's flag for a record it is sending again after an unacknowledged
   * disconnect. Kept because it explains a duplicate rather than excusing one —
   * the UNIQUE constraint refuses it either way.
   */
  isResend: boolean;
};

/** Why a record produced nothing. Absence of a reason means it parsed. */
export type ParseFailure =
  | "not-json"
  | "not-an-object"
  | "no-vin"
  | "no-timestamp"
  | "nothing-usable";

export const parseFailed = (r: Signal | { rejected: ParseFailure }): r is { rejected: ParseFailure } =>
  "rejected" in r;

/**
 * A number out of a protojson `Value`, whatever shape it took.
 *
 * Returns `undefined` rather than throwing or coercing: a value this cannot
 * read is one the caller must not treat as zero. `Number("")` is 0 and
 * `Number(null)` is 0, so the empty and null cases are refused before the
 * conversion rather than after it.
 */
function numeric(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;

  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;

  // int64 always, and floats sometimes. `"NaN"` and `"Infinity"` are legal
  // protojson for a double and must not become a reading.
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return undefined;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : undefined;
  }

  return undefined;
}

/** The first numeric member of a protojson `Value` union, in the order Tesla emits them. */
function valueAsNumber(value: unknown): number | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as Record<string, unknown>;

  // An explicit invalid marker beats every other field: the car is saying the
  // signal is unavailable, and reading the accompanying zero would be inventing
  // a measurement.
  if (v.invalid === true) return undefined;

  for (const key of ["doubleValue", "floatValue", "intValue", "longValue", "stringValue"]) {
    if (key in v) {
      const n = numeric(v[key]);
      if (n !== undefined) return n;
    }
  }
  return undefined;
}

/**
 * A coordinate pair, or nothing.
 *
 * Both halves are required together. A record with a latitude and no longitude
 * is not half a position, it is a corrupt one, and storing it would put a point
 * on the equator in the middle of the Yellow Sea.
 */
function valueAsLocation(value: unknown): { latitude: number; longitude: number } | undefined {
  if (!value || typeof value !== "object") return undefined;
  const loc = (value as Record<string, unknown>).locationValue;
  if (!loc || typeof loc !== "object") return undefined;

  const latitude = numeric((loc as Record<string, unknown>).latitude);
  const longitude = numeric((loc as Record<string, unknown>).longitude);
  if (latitude === undefined || longitude === undefined) return undefined;

  // Out-of-range is not clamped. A value outside these bounds did not come from
  // a satellite fix, and rounding it into range would make a wrong position
  // look like a plausible one.
  if (latitude < -90 || latitude > 90) return undefined;
  if (longitude < -180 || longitude > 180) return undefined;

  return { latitude, longitude };
}

/**
 * One record, as the consumer received it.
 *
 * Takes the raw string rather than a parsed object so that malformed JSON is
 * this function's problem and not the route's — the consumer forwards bytes it
 * never inspected, and something has to be the first thing that looks.
 */
export function parseRecord(raw: string): Signal | { rejected: ParseFailure } {
  let doc: unknown;
  try {
    doc = JSON.parse(raw);
  } catch {
    return { rejected: "not-json" };
  }
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    return { rejected: "not-an-object" };
  }

  const record = doc as Record<string, unknown>;

  const vin = typeof record.vin === "string" ? record.vin.trim() : "";
  if (!vin) return { rejected: "no-vin" };

  // The vehicle's clock, not the receiver's. Two frames that arrive out of
  // order still order correctly, and a resent batch produces the same key
  // rather than a new one.
  const createdAt = typeof record.createdAt === "string" ? Date.parse(record.createdAt) : NaN;
  if (!Number.isFinite(createdAt)) return { rejected: "no-timestamp" };

  const signal: Signal = {
    vin,
    recordedAt: createdAt,
    isResend: record.isResend === true,
  };

  const data = Array.isArray(record.data) ? record.data : [];
  for (const entry of data) {
    if (!entry || typeof entry !== "object") continue;
    const datum = entry as Record<string, unknown>;

    switch (datum.key) {
      case "Odometer": {
        const miles = valueAsNumber(datum.value);
        // Rejecting a non-positive odometer here as well as in `accrue` is not
        // duplication: this one stops a zero from becoming the "previous
        // reading" that every later delta is measured against.
        if (miles !== undefined && miles > 0) signal.odometerKm = milesToKm(miles);
        break;
      }
      case "Location": {
        const at = valueAsLocation(datum.value);
        if (at) {
          signal.latitude = at.latitude;
          signal.longitude = at.longitude;
        }
        break;
      }
      default:
        // Everything else a car may stream is ignored on purpose. The model
        // asks for a short list of signals and a firmware update that starts
        // sending more should change nothing here.
        break;
    }
  }

  if (signal.odometerKm === undefined && signal.latitude === undefined) {
    return { rejected: "nothing-usable" };
  }
  return signal;
}

/**
 * The channel a VIN's records arrive on.
 *
 * `BuildTopicName(namespace, txType)` then `%s_{%s}` in
 * `datastore/redis/redis.go` — the braces are literal characters in the channel
 * name, not a placeholder, because Redis reads them as a cluster hash tag.
 * Written down here because getting it wrong produces a consumer that connects,
 * subscribes, reports itself healthy and receives nothing.
 */
export const vinChannel = (namespace: string, vin: string) => `${namespace}_V_{${vin}}`;

/** The pattern that catches every VIN, so no vehicle list is needed to subscribe. */
export const vinChannelPattern = (namespace: string) => `${namespace}_V_*`;
