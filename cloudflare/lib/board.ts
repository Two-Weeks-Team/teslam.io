import type { BoardId, Comment, PostDetail, PostSummary, Sort } from "../../lib/board";

/**
 * Data access for the board.
 *
 * Same posture as db.ts: prepared statements, no ORM. The counters on `posts`
 * are denormalised, and every write that changes one goes through `db.batch`
 * so the counter and the row that justifies it land together. D1 runs a batch
 * as a single transaction, which is the only reason the denormalisation is
 * safe to do at all.
 */

const now = () => Math.floor(Date.now() / 1000);

const uuid = () => crypto.randomUUID();

/* ── accounts and sessions ────────────────────────────────────────────── */

export type Account = { id: string; handle: string };

/**
 * Sessions last a month.
 *
 * Long enough that a member who reads the board weekly is not signed out
 * between visits, short enough that an abandoned laptop stops being a way in
 * before the season it was abandoned in ends.
 */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

/**
 * The default handle.
 *
 * Derived from the placement so an account can post the moment it exists,
 * rather than bouncing a first-time member into a naming form before they have
 * seen the board. Deliberately not a word in any language: the member renames
 * themselves once, and until they do the name is obviously a placeholder
 * rather than something we decided they were called.
 */
export const defaultHandle = (kind: "seat" | "waitlist", number: number) =>
  `${kind === "seat" ? "genesis" : "driver"}-${String(number).padStart(3, "0")}`;

/**
 * Create the account for a freshly confirmed registration, or return the one
 * that already exists.
 *
 * `ON CONFLICT DO NOTHING` rather than a read-then-write: confirmation can be
 * replayed by a mail client that prefetches links, and two inserts racing on
 * the same registration must not surface as a 500.
 */
export async function ensureAccount(
  db: D1Database,
  registrationId: string,
  handle: string,
): Promise<Account> {
  await db
    .prepare(
      `INSERT INTO accounts (id, registration_id, handle, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(registration_id) DO NOTHING`,
    )
    .bind(uuid(), registrationId, handle, now())
    .run();

  const row = await db
    .prepare("SELECT id, handle FROM accounts WHERE registration_id = ?")
    .bind(registrationId)
    .first<Account>();

  if (!row) throw new Error("account insert reported success and then vanished");
  return row;
}

export async function createSession(
  db: D1Database,
  accountId: string,
  tokenHash: string,
): Promise<void> {
  const t = now();
  await db
    .prepare(
      `INSERT INTO sessions (token_hash, account_id, created_at, expires_at)
       VALUES (?, ?, ?, ?)`,
    )
    .bind(tokenHash, accountId, t, t + SESSION_TTL_SECONDS)
    .run();
}

/** Null for an unknown, expired or revoked token — the caller cannot tell which,
 *  and does not need to. */
export async function accountForSession(
  db: D1Database,
  tokenHash: string,
): Promise<Account | null> {
  return db
    .prepare(
      `SELECT a.id, a.handle
         FROM sessions s JOIN accounts a ON a.id = s.account_id
        WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .bind(tokenHash, now())
    .first<Account>();
}

export async function endSession(db: D1Database, tokenHash: string): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
}

/** Swept by the same cron that purges unconfirmed registrations. */
export async function purgeSessions(db: D1Database): Promise<number> {
  const res = await db
    .prepare("DELETE FROM sessions WHERE expires_at <= ?")
    .bind(now())
    .run();
  return res.meta.changes ?? 0;
}

/**
 * Rename, once.
 *
 * Returns false when the name is taken. A handle appears beside every post its
 * owner ever wrote, so letting it change freely would let somebody rewrite
 * their own history of statements — and letting it change into a name somebody
 * else is already using would let them rewrite another member's.
 */
export async function setHandle(
  db: D1Database,
  accountId: string,
  handle: string,
): Promise<"ok" | "taken" | "already_set"> {
  const current = await db
    .prepare("SELECT handle_set_at FROM accounts WHERE id = ?")
    .bind(accountId)
    .first<{ handle_set_at: number | null }>();
  if (current?.handle_set_at != null) return "already_set";

  try {
    const res = await db
      .prepare("UPDATE accounts SET handle = ?, handle_set_at = ? WHERE id = ? AND handle_set_at IS NULL")
      .bind(handle, now(), accountId)
      .run();
    return (res.meta.changes ?? 0) > 0 ? "ok" : "already_set";
  } catch {
    // The UNIQUE index is the authority on whether a name is free. Checking
    // first and then writing would leave a window between the two.
    return "taken";
  }
}

/* ── reading ──────────────────────────────────────────────────────────── */

const LIST_COLUMNS = `
  p.id, p.board, p.title, p.created_at, p.votes, p.comment_count, a.handle
`;

type Row = {
  id: string;
  board: string;
  title: string;
  created_at: number;
  votes: number;
  comment_count: number;
  handle: string;
  voted?: number | null;
};

const toSummary = (r: Row, signedIn: boolean): PostSummary => ({
  id: r.id,
  board: r.board as BoardId,
  title: r.title,
  handle: r.handle,
  createdAt: r.created_at,
  votes: r.votes,
  comments: r.comment_count,
  // Null and false are different facts: "you have not voted" versus "we do not
  // know who you are". The button renders differently for each.
  voted: signedIn ? Boolean(r.voted) : null,
});

export const PAGE_SIZE = 20;

/**
 * Ranking for the hot tab.
 *
 * Votes and replies over the age of the post, so a thread that drew twenty
 * replies this morning outranks one that drew thirty over a fortnight. The
 * constant stops a post from ranking on division by nearly zero in its first
 * seconds, which otherwise puts every brand-new post at the top for a minute
 * regardless of whether anybody engaged with it.
 */
const HOT = "(CAST(p.votes AS REAL) + p.comment_count) / (((? - p.created_at) / 3600.0) + 2)";

export async function listPosts(
  db: D1Database,
  opts: { board?: BoardId; sort: Sort; page: number; accountId?: string },
): Promise<{ posts: PostSummary[]; more: boolean }> {
  const signedIn = Boolean(opts.accountId);
  const offset = Math.max(0, opts.page) * PAGE_SIZE;

  // One extra row, to answer "is there a next page" without a second count
  // query over a table that will get large.
  const limit = PAGE_SIZE + 1;

  const where = ["p.deleted_at IS NULL"];
  const filters: unknown[] = [];
  if (opts.board) {
    where.push("p.board = ?");
    filters.push(opts.board);
  }

  const voted = signedIn
    ? ", EXISTS(SELECT 1 FROM post_votes v WHERE v.post_id = p.id AND v.account_id = ?) AS voted"
    : "";
  const votedBind = signedIn ? [opts.accountId] : [];

  const order = opts.sort === "hot" ? `${HOT} DESC, p.created_at DESC` : "p.created_at DESC";
  const orderBind = opts.sort === "hot" ? [now()] : [];

  const res = await db
    .prepare(
      `SELECT ${LIST_COLUMNS}${voted}
         FROM posts p JOIN accounts a ON a.id = p.account_id
        WHERE ${where.join(" AND ")}
        ORDER BY ${order}
        LIMIT ? OFFSET ?`,
    )
    .bind(...votedBind, ...filters, ...orderBind, limit, offset)
    .all<Row>();

  const rows = res.results ?? [];
  return {
    posts: rows.slice(0, PAGE_SIZE).map((r) => toSummary(r, signedIn)),
    more: rows.length > PAGE_SIZE,
  };
}

export async function getPost(
  db: D1Database,
  id: string,
  accountId?: string,
): Promise<PostDetail | null> {
  const signedIn = Boolean(accountId);
  const voted = signedIn
    ? ", EXISTS(SELECT 1 FROM post_votes v WHERE v.post_id = p.id AND v.account_id = ?) AS voted"
    : "";

  const row = await db
    .prepare(
      `SELECT ${LIST_COLUMNS}, p.body${voted}
         FROM posts p JOIN accounts a ON a.id = p.account_id
        WHERE p.id = ? AND p.deleted_at IS NULL`,
    )
    .bind(...(signedIn ? [accountId] : []), id)
    .first<Row & { body: string }>();

  if (!row) return null;

  const thread = await db
    .prepare(
      `SELECT c.id, c.body, c.created_at, a.handle
         FROM comments c JOIN accounts a ON a.id = c.account_id
        WHERE c.post_id = ? AND c.deleted_at IS NULL
        ORDER BY c.created_at ASC
        LIMIT 500`,
    )
    .bind(id)
    .all<{ id: string; body: string; created_at: number; handle: string }>();

  return {
    ...toSummary(row, signedIn),
    body: row.body,
    thread: (thread.results ?? []).map(
      (c): Comment => ({
        id: c.id,
        handle: c.handle,
        body: c.body,
        createdAt: c.created_at,
      }),
    ),
  };
}

/** Counts per board, for the rail. Boards with no posts are simply absent. */
export async function boardCounts(db: D1Database): Promise<Record<string, number>> {
  const res = await db
    .prepare(
      "SELECT board, COUNT(*) AS n FROM posts WHERE deleted_at IS NULL GROUP BY board",
    )
    .all<{ board: string; n: number }>();
  return Object.fromEntries((res.results ?? []).map((r) => [r.board, r.n]));
}

export async function postCount(db: D1Database): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM posts WHERE deleted_at IS NULL")
    .first<{ n: number }>();
  return row?.n ?? 0;
}

/* ── writing ──────────────────────────────────────────────────────────── */

/**
 * How many posts one account may write per hour.
 *
 * The IP limiter in front of the Worker does not help here: an account is
 * already a scarce thing to obtain, so the risk is not volume from strangers
 * but one member flooding the board from one browser.
 */
export const POSTS_PER_HOUR = 10;
export const COMMENTS_PER_HOUR = 60;

async function recentCount(
  db: D1Database,
  table: "posts" | "comments",
  accountId: string,
): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM ${table} WHERE account_id = ? AND created_at > ?`,
    )
    .bind(accountId, now() - 3600)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function createPost(
  db: D1Database,
  accountId: string,
  post: { board: BoardId; title: string; body: string },
): Promise<{ id: string } | "rate_limited"> {
  if ((await recentCount(db, "posts", accountId)) >= POSTS_PER_HOUR) {
    return "rate_limited";
  }

  const id = uuid();
  await db
    .prepare(
      `INSERT INTO posts (id, account_id, board, title, body, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, accountId, post.board, post.title, post.body, now())
    .run();
  return { id };
}

export async function createComment(
  db: D1Database,
  accountId: string,
  postId: string,
  body: string,
): Promise<{ id: string } | "rate_limited" | "no_post"> {
  const post = await db
    .prepare("SELECT id FROM posts WHERE id = ? AND deleted_at IS NULL")
    .bind(postId)
    .first<{ id: string }>();
  if (!post) return "no_post";

  if ((await recentCount(db, "comments", accountId)) >= COMMENTS_PER_HOUR) {
    return "rate_limited";
  }

  const id = uuid();
  // The counter and the comment in one transaction. Incrementing afterwards
  // would leave a thread whose reply count is a lie whenever the second write
  // fails, and that is the write most likely to fail.
  await db.batch([
    db
      .prepare(
        `INSERT INTO comments (id, post_id, account_id, body, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(id, postId, accountId, body, now()),
    db
      .prepare("UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?")
      .bind(postId),
  ]);

  return { id };
}

/**
 * Toggle a vote.
 *
 * Returns the resulting state so the caller never has to guess, and the button
 * never has to assume its own click succeeded. A repeated request from a
 * double-tap flips back rather than double-counting, which is the behaviour a
 * primary key gives for free and an "increment" column does not.
 */
export async function toggleVote(
  db: D1Database,
  accountId: string,
  postId: string,
): Promise<{ voted: boolean; votes: number } | "no_post"> {
  const post = await db
    .prepare("SELECT id FROM posts WHERE id = ? AND deleted_at IS NULL")
    .bind(postId)
    .first<{ id: string }>();
  if (!post) return "no_post";

  const existing = await db
    .prepare("SELECT 1 AS x FROM post_votes WHERE post_id = ? AND account_id = ?")
    .bind(postId, accountId)
    .first<{ x: number }>();

  if (existing) {
    await db.batch([
      db
        .prepare("DELETE FROM post_votes WHERE post_id = ? AND account_id = ?")
        .bind(postId, accountId),
      db
        .prepare("UPDATE posts SET votes = MAX(0, votes - 1) WHERE id = ?")
        .bind(postId),
    ]);
  } else {
    await db.batch([
      db
        .prepare(
          `INSERT INTO post_votes (post_id, account_id, created_at) VALUES (?, ?, ?)
           ON CONFLICT DO NOTHING`,
        )
        .bind(postId, accountId, now()),
      db.prepare("UPDATE posts SET votes = votes + 1 WHERE id = ?").bind(postId),
    ]);
  }

  const after = await db
    .prepare("SELECT votes FROM posts WHERE id = ?")
    .bind(postId)
    .first<{ votes: number }>();

  return { voted: !existing, votes: after?.votes ?? 0 };
}
