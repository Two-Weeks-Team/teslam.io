-- Genesis 500 pre-registration.
--
-- One table. Every column is either something the registrant typed or
-- something the seat allocation needs; there is no column here that exists
-- "in case it is useful later", because a column like that is personal data
-- nobody agreed to hand over.
--
-- Not present, deliberately: any coordinate, any VIN, any phone number, any
-- payment detail, any IP address. Those absences are promised in the privacy
-- policy and are what the schema is for.

CREATE TABLE registrations (
  id                TEXT PRIMARY KEY,
  seat_no           INTEGER UNIQUE,
  waitlist_no       INTEGER UNIQUE,

  email             TEXT NOT NULL UNIQUE,
  verified_at       INTEGER,
  -- Only the hash. A leaked table must not be a set of working confirmation
  -- links, and the operator has no reason to be able to confirm on someone
  -- else's behalf.
  verify_token_hash TEXT,
  verify_sent_at    INTEGER,

  model             TEXT NOT NULL,
  trim              TEXT NOT NULL,
  region            TEXT NOT NULL,
  km_band           TEXT NOT NULL,

  consent_terms     INTEGER NOT NULL,
  consent_privacy   INTEGER NOT NULL,
  consent_marketing INTEGER NOT NULL DEFAULT 0,
  consent_at        INTEGER NOT NULL,

  created_at        INTEGER NOT NULL
);

-- The public figures: how many seats are taken, and where they are.
-- Partial, because an unconfirmed registration holds no seat and must not
-- appear in a count the front page presents as real.
CREATE INDEX idx_reg_region_taken
  ON registrations (region)
  WHERE seat_no IS NOT NULL;

CREATE INDEX idx_reg_seat ON registrations (seat_no);
CREATE INDEX idx_reg_waitlist ON registrations (waitlist_no);

-- Confirmation looks a row up by token hash and nothing else.
CREATE INDEX idx_reg_token ON registrations (verify_token_hash)
  WHERE verify_token_hash IS NOT NULL;
