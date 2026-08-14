-- The board.
--
-- Until now every post on the front page was written by hand into
-- data/community.json and labelled as sample content. This is the real thing:
-- rows a member wrote, that another member can read, vote on and reply to.
--
-- Identity is a Genesis seat. There is no password, no separate sign-up and no
-- profile: confirming the registration mail is the whole account creation, so
-- the set of people who can post is exactly the set of people who proved they
-- hold a mailbox and told us which car they drive. That is a deliberate ceiling
-- on abuse — an attacker needs a confirmed registration per identity, not a
-- fresh cookie.
--
-- Still absent, as in 0001: any coordinate, any VIN, any IP address. A post
-- carries what its author typed and nothing the server inferred about them.

CREATE TABLE accounts (
  id              TEXT PRIMARY KEY,
  -- One account per registration, enforced here rather than in application
  -- code, because two accounts on one seat would be two votes on one post.
  registration_id TEXT NOT NULL UNIQUE REFERENCES registrations(id) ON DELETE CASCADE,
  -- Assigned at creation from the seat number so an account is postable the
  -- moment it exists, and changeable once by its owner. Locale-neutral on
  -- purpose: a display string in the database renders untranslated on /en.
  handle          TEXT NOT NULL UNIQUE,
  handle_set_at   INTEGER,
  created_at      INTEGER NOT NULL
);

-- Sessions.
--
-- Only the hash, for the same reason 0001 stores only the hash of the
-- confirmation token: a leaked table must not be a drawer full of working keys.
-- Rows are deleted on sign-out and swept by the daily cron once expired.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX idx_sessions_account ON sessions (account_id);
CREATE INDEX idx_sessions_expiry ON sessions (expires_at);

CREATE TABLE posts (
  id            TEXT PRIMARY KEY,
  account_id    TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  board         TEXT NOT NULL,
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  -- Denormalised so a list of twenty posts is one query rather than
  -- twenty-one. Both counters are written in the same batch as the row that
  -- causes them to change, so they cannot drift.
  votes         INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  -- Soft delete. A removed post leaves a hole in a comment thread otherwise,
  -- and the vote rows that referenced it would have to be destroyed with it.
  deleted_at    INTEGER
);

CREATE INDEX idx_posts_board_new ON posts (board, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_posts_new ON posts (created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_posts_account ON posts (account_id, created_at DESC);

CREATE TABLE comments (
  id         TEXT PRIMARY KEY,
  post_id    TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  deleted_at INTEGER
);

CREATE INDEX idx_comments_post ON comments (post_id, created_at) WHERE deleted_at IS NULL;

-- One vote per account per post, enforced by the primary key. A toggle deletes
-- the row; there is no "unvote" value to get wrong, and a double-submit is a
-- no-op rather than a second vote.
CREATE TABLE post_votes (
  post_id    TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (post_id, account_id)
);

CREATE INDEX idx_votes_account ON post_votes (account_id);
