import { SEATS, type KmBandId, type Model, type RegionId } from "../../lib/genesis";

/**
 * Data access for Genesis 500 registrations.
 *
 * Written against D1's prepared statements rather than an ORM. The design note
 * called for drizzle, to match the satellite project; one table and six queries
 * did not earn the dependency plus a codegen step that can go stale. If this
 * schema grows joins, revisit that.
 */

export type Registration = {
  id: string;
  seat_no: number | null;
  waitlist_no: number | null;
  email: string;
  verified_at: number | null;
  model: string;
  trim: string;
  region: string;
  km_band: string;
};

export type NewRegistration = {
  email: string;
  model: Model;
  trim: string;
  region: RegionId;
  kmBand: KmBandId;
  consentMarketing: boolean;
  tokenHash: string;
};

export type Placement = {
  kind: "seat" | "waitlist";
  number: number;
  /** The row this placement belongs to. The board turns it into an account;
   *  nothing else may use it, and it is never sent to a client. */
  registrationId: string;
  /** Carried out of the same statement so the live board can be told what
   *  happened without a second read. */
  region: string;
  model: string;
};

const now = () => Math.floor(Date.now() / 1000);

/**
 * How long a confirmation link stays usable.
 *
 * `verify_sent_at` was in the schema and in nothing else, so a link stayed
 * valid forever: an old mailbox that leaked years later would still hold a
 * working key to a seat. Seven days is long enough for someone who registered
 * on holiday and short enough that a stale message is not a credential.
 */
export const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

/** Rows written by a request that never confirmed are not registrations. */
export async function findByEmail(db: D1Database, email: string) {
  return db
    .prepare("SELECT id, seat_no, waitlist_no, verified_at FROM registrations WHERE email = ?")
    .bind(email)
    .first<Pick<Registration, "id" | "seat_no" | "waitlist_no" | "verified_at">>();
}

/**
 * Returns false when the address already had a row, which the caller resolves
 * by refreshing instead. Two requests for the same new address arriving
 * together both read "no existing row", and without `ON CONFLICT` the loser
 * raised a UNIQUE violation that reached the client as a 500 with no CORS
 * headers — a crash where a resend was meant.
 */
export async function insertPending(
  db: D1Database,
  r: NewRegistration,
): Promise<boolean> {
  const id = crypto.randomUUID();
  const t = now();
  const res = await db
    .prepare(
      `INSERT INTO registrations
         (id, email, verify_token_hash, verify_sent_at,
          model, trim, region, km_band,
          consent_terms, consent_privacy, consent_marketing, consent_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?)
       ON CONFLICT(email) DO NOTHING`,
    )
    .bind(
      id,
      r.email,
      r.tokenHash,
      t,
      r.model,
      r.trim,
      r.region,
      r.kmBand,
      r.consentMarketing ? 1 : 0,
      t,
      t,
    )
    .run();
  return (res.meta.changes ?? 0) > 0;
}

/**
 * Delete unconfirmed registrations whose link has expired.
 *
 * The confirmation email promises that "nothing was stored beyond the address
 * it was sent to, and it is deleted unconfirmed" — a promise the cohort had no
 * code to keep. Run from the scheduled handler.
 */
export async function purgeExpired(db: D1Database): Promise<number> {
  const res = await db
    .prepare(
      `DELETE FROM registrations
        WHERE verified_at IS NULL AND verify_sent_at < ?`,
    )
    .bind(now() - TOKEN_TTL_SECONDS)
    .run();
  return res.meta.changes ?? 0;
}

/**
 * Replace an unconfirmed registration with the submission just made.
 *
 * Not just a fresh token. Someone who resubmits the same address is correcting
 * something — a different car, a region they mistyped, marketing they no longer
 * want — and keeping the old values would confirm them against a profile they
 * had already replaced. The consent record matters most: a stale opt-in is a
 * record asserting the opposite of what the person chose a moment ago.
 *
 * Only touches rows that have not been confirmed. A held seat is not editable
 * through this path.
 */
export async function refreshPending(
  db: D1Database,
  r: NewRegistration,
): Promise<boolean> {
  const t = now();
  const res = await db
    .prepare(
      `UPDATE registrations
          SET verify_token_hash = ?, verify_sent_at = ?,
              model = ?, trim = ?, region = ?, km_band = ?,
              consent_marketing = ?, consent_at = ?
        WHERE email = ? AND verified_at IS NULL`,
    )
    .bind(
      r.tokenHash,
      t,
      r.model,
      r.trim,
      r.region,
      r.kmBand,
      r.consentMarketing ? 1 : 0,
      t,
      r.email,
    )
    .run();
  return (res.meta.changes ?? 0) > 0;
}

/**
 * The smallest seat number not currently held.
 *
 * Not `MAX + 1`. Withdrawal deletes a row, and with `MAX + 1` the gap it leaves
 * would push a later registrant past 500 while fewer than 500 seats were
 * actually occupied — a cohort of "500" holding 499 people and numbering
 * someone 501. Filling the lowest free number keeps the cohort exactly the size
 * it is named after.
 */
/**
 * Confirm an email and place the registrant, in one statement.
 *
 * The obvious shape — read the next free seat, then write it — is a race, and
 * not a rare one: every confirmation that arrives in the same moment reads the
 * same number and all but one lose. Retrying turns that into O(n) contention,
 * which is how the first version of this failed with twelve people confirming
 * at once.
 *
 * Letting SQLite choose inside the UPDATE removes the gap entirely. The
 * subqueries see the table as it was when the statement began, D1 serialises
 * writers, so each confirmation observes every earlier one as committed.
 *
 * `seat_no` takes the lowest number not currently held, and is NULL once the
 * cohort is full; `waitlist_no` is set only in that case. RETURNING reports
 * which happened without a second read.
 */
const PLACE = `
  UPDATE registrations
     SET verified_at = ?,
         verify_token_hash = NULL,
         seat_no = (
           WITH RECURSIVE seq(n) AS (
             SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < ?
           )
           SELECT MIN(n) FROM seq
            WHERE n NOT IN (
              SELECT seat_no FROM registrations WHERE seat_no IS NOT NULL
            )
         ),
         waitlist_no = CASE
           WHEN (SELECT COUNT(seat_no) FROM registrations) >= ?
           THEN (SELECT COALESCE(MAX(waitlist_no), ?) + 1 FROM registrations)
           ELSE NULL
         END
   WHERE verify_token_hash = ? AND verified_at IS NULL
     AND verify_sent_at >= ?
  RETURNING id, seat_no, waitlist_no, region, model
`;

export async function confirm(
  db: D1Database,
  tokenHash: string,
): Promise<Placement | null> {
  const res = await db
    .prepare(PLACE)
    .bind(now(), SEATS, SEATS, SEATS, tokenHash, now() - TOKEN_TTL_SECONDS)
    .all<{
      id: string;
      seat_no: number | null;
      waitlist_no: number | null;
      region: string;
      model: string;
    }>();

  const row = res.results?.[0];
  if (!row) return null;

  const common = { registrationId: row.id, region: row.region, model: row.model };
  if (row.seat_no != null) return { kind: "seat", number: row.seat_no, ...common };
  if (row.waitlist_no != null)
    return { kind: "waitlist", number: row.waitlist_no, ...common };

  throw new Error("confirmation placed a registrant nowhere");
}

/** How many seats are held. Used to keep the live board's counter honest. */
export async function takenCount(db: D1Database): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(seat_no) AS n FROM registrations")
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export type Stats = {
  seats: number;
  taken: number;
  waitlist: number;
  byRegion: Array<{ region: string; count: number }>;
  recent: Array<{ seatNo: number; region: string; model: string; at: number }>;
};

/**
 * Public figures only.
 *
 * `recent` carries a seat number, a region and a model — enough for the board
 * to feel inhabited, and not enough to identify anybody. No email leaves this
 * function, which is asserted in the tests rather than left to review.
 */
export async function stats(db: D1Database): Promise<Stats> {
  const [counts, regions, recent] = await db.batch<never>([
    db.prepare(
      `SELECT
         COUNT(seat_no) AS taken,
         COUNT(waitlist_no) AS waitlist
       FROM registrations`,
    ),
    db.prepare(
      `SELECT region, COUNT(*) AS count
         FROM registrations
        WHERE seat_no IS NOT NULL
        GROUP BY region`,
    ),
    db.prepare(
      `SELECT seat_no AS seatNo, region, model, verified_at AS at
         FROM registrations
        WHERE seat_no IS NOT NULL
        ORDER BY verified_at DESC
        LIMIT 8`,
    ),
  ]);

  const c = (counts.results?.[0] ?? {}) as { taken?: number; waitlist?: number };

  return {
    seats: SEATS,
    taken: c.taken ?? 0,
    waitlist: c.waitlist ?? 0,
    byRegion: (regions.results ?? []) as Stats["byRegion"],
    recent: (recent.results ?? []) as Stats["recent"],
  };
}
