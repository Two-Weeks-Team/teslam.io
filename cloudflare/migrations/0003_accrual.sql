-- The accrual ledger.
--
-- Everything the site says rests on one sentence: "두 시점의 차이만 쓰므로
-- 되감기가 불가능합니다." That is a claim about this file. If the same
-- odometer reading can be credited twice, or a lower reading can be credited
-- at all, the sentence is marketing and the league is a scoreboard anybody can
-- edit by replaying a request.
--
-- So the rules live in constraints rather than in application code. Logic
-- changes with a deploy and a mistake ships silently; a UNIQUE index refuses
-- the row whatever the caller believes. Two of them do most of the work here,
-- and they are the reason this table shape is worth arguing about:
--
--   `odometer_readings(vehicle_id, recorded_at)` — the same instant cannot be
--   recorded twice, so a replayed telemetry frame is rejected by the database
--   rather than deduplicated by a query somebody might later "optimise".
--
--   `drv_ledger(vehicle_id, to_reading_id)` — a reading can close exactly one
--   accrual interval, ever. Retrying a crashed consumer credits nothing extra.
--
-- Still absent, as in 0001 and 0002: any coordinate. The columns for one exist
-- and are documented below, but nothing writes them and the model does not ask
-- Tesla for `Location`. Collecting coordinates in Korea requires a filing under
-- 위치정보법 that has not been made, and the privacy policy currently tells
-- readers that location is not received at any stage. The shape is here so the
-- schema does not have to be rewritten later; the switch is deliberately not.

-- Vehicles.
--
-- A vehicle belongs to an account, and an account may hold several — one
-- household, two cars, one seat. Accrual is per vehicle because the odometer
-- is, and the daily cap is per vehicle for the same reason.
CREATE TABLE vehicles (
  id                TEXT PRIMARY KEY,
  account_id        TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  -- Tesla's own identifier. Not the VIN: 0001 and 0002 both promise no VIN is
  -- stored, and `id` from the vehicles endpoint is sufficient to address a car
  -- through the API without holding the number stamped on its chassis.
  tesla_vehicle_id  TEXT NOT NULL UNIQUE,
  -- Model and trim, for the garage card. Free text from Tesla, shown as-is.
  display_name      TEXT,
  -- Refresh token, encrypted at rest by the Worker. Access tokens are not
  -- stored at all — they last eight hours and can always be minted again.
  refresh_token_enc TEXT,
  -- Set when the owner revokes, so accrual stops without losing the history.
  revoked_at        INTEGER,
  linked_at         INTEGER NOT NULL,
  created_at        INTEGER NOT NULL
);

CREATE INDEX idx_vehicles_account ON vehicles(account_id);
CREATE INDEX idx_vehicles_active ON vehicles(revoked_at) WHERE revoked_at IS NULL;

-- Readings.
--
-- Append-only. A row is a fact the car reported, and facts are not edited.
--
-- `recorded_at` is the vehicle's own timestamp, not the server's: two frames
-- that arrive out of order still order correctly, and a receiver retrying a
-- batch produces the same key rather than a new one.
CREATE TABLE odometer_readings (
  id           TEXT PRIMARY KEY,
  vehicle_id   TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  -- Milliseconds since epoch, from the vehicle.
  recorded_at  INTEGER NOT NULL,
  -- Kilometres. Tesla reports `Odometer` in miles and the conversion happens
  -- once, on the way in, because a unit that changes depending on which table
  -- you read is a bug waiting for its moment. Stored as REAL: the odometer is
  -- a real-valued measurement and rounding it here would make every delta
  -- slightly wrong in the same direction.
  odometer_km  REAL NOT NULL,
  -- `stream` from Fleet Telemetry, `poll` from vehicle_data if ever needed.
  source       TEXT NOT NULL,
  received_at  INTEGER NOT NULL,

  -- The replay guard. A telemetry frame redelivered after an unacknowledged
  -- disconnect — which Tesla's own docs say to expect — carries the same
  -- vehicle and the same instant, and is refused here.
  UNIQUE (vehicle_id, recorded_at)
);

CREATE INDEX idx_readings_vehicle_time ON odometer_readings(vehicle_id, recorded_at);

-- The ledger.
--
-- One row per accrual interval: the reading it starts from, the reading it
-- ends at, the distance between them, and what that earned. Append-only, so a
-- balance is a sum and never a stored number that can drift from its own
-- history.
CREATE TABLE drv_ledger (
  id              TEXT PRIMARY KEY,
  vehicle_id      TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  account_id      TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

  from_reading_id TEXT NOT NULL REFERENCES odometer_readings(id),
  to_reading_id   TEXT NOT NULL REFERENCES odometer_readings(id),

  -- Always positive: a non-increasing pair is not an interval and is rejected
  -- before it reaches this table. An odometer that appears to go backwards is
  -- a replaced instrument cluster or a corrupt frame, and either way it is not
  -- distance somebody drove.
  delta_km        REAL NOT NULL CHECK (delta_km > 0),

  -- What was credited, after the daily cap. `drv_uncapped` keeps what the
  -- distance would have earned, so a member can see the cap acting on them
  -- rather than silently losing kilometres — the site promises a cap, not a
  -- disappearance.
  drv             INTEGER NOT NULL CHECK (drv >= 0),
  drv_uncapped    INTEGER NOT NULL,

  -- The local day the cap was applied against, as YYYY-MM-DD in Asia/Seoul.
  -- Stored rather than derived: the cap is a promise made in a timezone, and
  -- recomputing it later from UTC in a different one would move the boundary.
  accrual_day     TEXT NOT NULL,

  created_at      INTEGER NOT NULL,

  -- The idempotency guard, and the reason a crashed consumer is safe to
  -- restart. A reading closes exactly one interval for its vehicle; a retry
  -- collides here and credits nothing.
  UNIQUE (vehicle_id, to_reading_id)
);

CREATE INDEX idx_ledger_account ON drv_ledger(account_id, created_at DESC);
CREATE INDEX idx_ledger_vehicle_day ON drv_ledger(vehicle_id, accrual_day);

-- Coordinates, when they are lawful to collect.
--
-- Deliberately a separate table rather than columns on `odometer_readings`.
-- Two reasons, and both are about being able to keep a promise:
--
--   Location can be dropped without touching accrual. A deletion request, or a
--   decision to stop collecting, is one `DELETE FROM` — not a migration that
--   rewrites every reading and risks the ledger that depends on them.
--
--   The retention periods differ. A reading is the basis of a balance and has
--   to live as long as the balance does; a coordinate is a cross-check and
--   should not.
--
-- Nothing writes this yet. `data/model.json` does not request `Location`, the
-- 위치정보법 filing has not been made, and the privacy policy still tells
-- readers that location is not received at any stage. All three change
-- together or none do.
CREATE TABLE reading_locations (
  reading_id  TEXT PRIMARY KEY REFERENCES odometer_readings(id) ON DELETE CASCADE,
  latitude    REAL NOT NULL,
  longitude   REAL NOT NULL,
  -- When this coordinate becomes eligible for deletion. Written at insert from
  -- the retention period the policy states, so expiry is a property of the row
  -- and not of whichever job happens to run.
  expires_at  INTEGER NOT NULL
);

CREATE INDEX idx_locations_expiry ON reading_locations(expires_at);
