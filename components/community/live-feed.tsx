"use client";

import { useEffect, useRef, useState } from "react";
import { BOARDS, LIMITS, countChars, type BoardId, type PostSummary, type Sort } from "@/lib/board";
import { board, useSession } from "@/components/community/session";
import { getContent, boardPathFor, genesisPathFor, type Locale } from "@/lib/i18n";
import { ago, n } from "@/lib/format";
import type { Page } from "@/lib/posts";

/**
 * The board itself.
 *
 * Rendered from `initial`, which the server already fetched, so the posts are
 * in the HTML before this component ever runs. What hydration adds is the part
 * that needs a present reader: voting, the next page, and writing.
 *
 * `now` is passed down from the server render rather than read here, because
 * "3분 전" computed on the server and "5분 전" computed on the client is a
 * hydration mismatch — and the one place it would bite is the newest post,
 * which is the one people look at.
 */

export function LiveFeed({
  locale,
  initial,
  now,
}: {
  locale: Locale;
  initial: Page;
  now: number;
}) {
  const t = getContent(locale).feed;
  const { signedIn } = useSession();

  /** One object, so a change of tab and a reset of the page number are a single
   *  render and a single fetch rather than two of each. */
  const [query, setQuery] = useState<{ sort: Sort; filter: BoardId | null; page: number }>({
    sort: "hot",
    filter: null,
    page: 0,
  });
  const { sort, filter } = query;

  const [posts, setPosts] = useState<PostSummary[]>(initial.posts);
  const [more, setMore] = useState(initial.more);
  const [busy, setBusy] = useState(false);
  const [writing, setWriting] = useState(false);

  // The server already fetched exactly this, so the first render must not
  // refetch it — that would discard correct HTML and flicker the board on
  // every load. The exception is a signed-in reader, whose list carries one
  // extra column the anonymous server render could not know: their own votes.
  const fetched = useRef(false);

  useEffect(() => {
    const first = !fetched.current;
    fetched.current = true;
    if (first && !signedIn) return;

    let cancelled = false;
    const append = query.page > 0;
    const params = new URLSearchParams({ sort: query.sort, page: String(query.page) });
    if (query.filter) params.set("board", query.filter);

    board(`/v1/board/posts?${params}`)
      .then((res) => (res.ok ? (res.json() as Promise<Page>) : null))
      .then((body) => {
        if (cancelled || !body) return;
        setPosts((prev) => (append ? [...prev, ...body.posts] : body.posts));
        setMore(body.more);
        setBusy(false);
      })
      .catch(() => {
        // Leave what is on screen. A list that empties itself because the
        // network blinked is worse than one that is briefly stale.
        if (!cancelled) setBusy(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query, signedIn]);

  const choose = (next: { sort?: Sort; filter?: BoardId | null }) =>
    setQuery((q) => ({
      sort: next.sort ?? q.sort,
      filter: next.filter !== undefined ? next.filter : q.filter,
      page: 0,
    }));

  const nextPage = () => {
    setBusy(true);
    setQuery((q) => ({ ...q, page: q.page + 1 }));
  };

  return (
    <section className="feed" id="feed" aria-labelledby="feed-h">
      <h2 className="skip" id="feed-h">
        {t.title}
      </h2>

      <div className="feed__top">
        <div className="tabs" role="tablist" aria-label={t.title}>
          <button
            className={sort === "hot" ? "tab tab--on" : "tab"}
            onClick={() => choose({ sort: "hot" })}
            role="tab"
            aria-selected={sort === "hot"}
            type="button"
          >
            🔥 {t.tabs.hot}
          </button>
          <button
            className={sort === "new" ? "tab tab--on" : "tab"}
            onClick={() => choose({ sort: "new" })}
            role="tab"
            aria-selected={sort === "new"}
            type="button"
          >
            {t.tabs.latest}
          </button>
          {filter ? (
            <button className="tab tab--clear" onClick={() => choose({ filter: null })} type="button">
              {BOARDS.find((b) => b.id === filter)?.[locale]} ✕
            </button>
          ) : null}
        </div>

        <p className="feed__meta">
          {posts.length > 0 ? `${n(locale, posts.length)}${t.shown}` : null}
        </p>
      </div>

      <Compose
        locale={locale}
        open={writing}
        onOpen={() => setWriting(true)}
        onClose={() => setWriting(false)}
        // Straight to the newest tab, where what they just wrote is first.
        // Landing back on "hot" with their post ranked somewhere below the fold
        // reads as the post having failed to save.
        onPosted={() => {
          setWriting(false);
          choose({ sort: "new" });
        }}
      />

      {posts.length === 0 ? (
        <p className="feed__empty">{t.empty}</p>
      ) : (
        posts.map((p) => (
          <Row key={p.id} locale={locale} post={p} now={now} onBoard={(b) => choose({ filter: b })} />
        ))
      )}

      {more ? (
        <button className="feed__more" onClick={nextPage} disabled={busy} type="button">
          {busy ? t.loading : `${t.more} →`}
        </button>
      ) : null}
    </section>
  );
}

/* ── one row ──────────────────────────────────────────────────────────── */

function Row({
  locale,
  post,
  now,
  onBoard,
}: {
  locale: Locale;
  post: PostSummary;
  now: number;
  onBoard: (b: BoardId) => void;
}) {
  const t = getContent(locale).feed;
  const { signedIn } = useSession();

  /*
   * The arrow answers the press, not the round trip.
   *
   * `local` holds what this reader just did; `post` is what the list last
   * fetched. Whenever a fresh row arrives the override is dropped, so the
   * server's count always wins in the end — an optimistic number that never
   * reconciles is a lie the reader has no way to notice.
   *
   * Adjusting state during render rather than in an effect is deliberate: an
   * effect would paint the stale count first and correct it on the next frame,
   * which is a visible flicker on exactly the row somebody is looking at.
   */
  const [local, setLocal] = useState<{ votes: number; voted: boolean | null } | null>(null);
  const [seen, setSeen] = useState(post);
  const [pending, setPending] = useState(false);

  if (seen !== post) {
    setSeen(post);
    setLocal(null);
  }

  const votes = local?.votes ?? post.votes;
  const voted = local ? local.voted : post.voted;

  const vote = async () => {
    if (!signedIn || pending) return;
    setPending(true);
    const wasVoted = voted === true;
    setLocal({ voted: !wasVoted, votes: votes + (wasVoted ? -1 : 1) });
    try {
      const res = await board(`/v1/board/posts/${post.id}/vote`, { method: "POST" });
      if (res.ok) {
        const body = (await res.json()) as { voted: boolean; votes: number };
        setLocal({ voted: body.voted, votes: body.votes });
      } else {
        setLocal(null);
      }
    } catch {
      setLocal(null);
    } finally {
      setPending(false);
    }
  };

  return (
    <article className="post">
      <div className="post__v">
        <button
          className={voted ? "post__vote is-on" : "post__vote"}
          onClick={vote}
          disabled={!signedIn || pending}
          title={signedIn ? t.vote : t.voteSignedOut}
          aria-pressed={voted === true}
          type="button"
        >
          <span className="post__vn">{votes >= 1000 ? `${(votes / 1000).toFixed(1)}k` : n(locale, votes)}</span>
          <span className="post__vl" aria-hidden="true">
            ▲
          </span>
        </button>
      </div>

      <div className="post__b">
        <div className="post__tags">
          <button className="chip chip--btn" onClick={() => onBoard(post.board)} type="button">
            {BOARDS.find((b) => b.id === post.board)?.[locale] ?? post.board}
          </button>
        </div>

        <a className="post__t" href={`${boardPathFor(locale)}/${post.id}`}>
          {post.title}
          {post.comments > 0 ? <span className="post__c">[{n(locale, post.comments)}]</span> : null}
        </a>

        <p className="post__m">
          {post.handle} · {ago(locale, post.createdAt, now)}
        </p>
      </div>
    </article>
  );
}

/* ── writing ──────────────────────────────────────────────────────────── */

function Compose({
  locale,
  open,
  onOpen,
  onClose,
  onPosted,
}: {
  locale: Locale;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onPosted: () => void;
}) {
  const t = getContent(locale).compose;
  const { signedIn, handle } = useSession();

  const [boardId, setBoardId] = useState<BoardId>("free");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // Undefined means we have not asked yet. Showing the sign-in prompt during
  // that gap tells a signed-in member they are not, every single load.
  if (handle === undefined) return <div className="cmp cmp--wait" aria-hidden="true" />;

  if (!signedIn) {
    return (
      <p className="cmp cmp--out">
        <span>{t.signedOut}</span>
        <a className="btn btn--ghost btn--sm" href={genesisPathFor(locale)}>
          {t.signedOutCta}
        </a>
      </p>
    );
  }

  if (!open) {
    return (
      <button className="cmp cmp--open" onClick={onOpen} type="button">
        <span className="cmp__who">{handle}</span>
        <span className="cmp__hint">{t.placeholder}</span>
      </button>
    );
  }

  const titleLeft = LIMITS.title.max - countChars(title);
  const bodyLeft = LIMITS.body.max - countChars(body);
  const valid =
    countChars(title.trim()) >= LIMITS.title.min &&
    countChars(body.trim()) >= LIMITS.body.min &&
    titleLeft >= 0 &&
    bodyLeft >= 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await board("/v1/board/posts", {
        method: "POST",
        body: JSON.stringify({ board: boardId, title: title.trim(), body: body.trim() }),
      });
      if (res.status === 201) {
        setTitle("");
        setBody("");
        onPosted();
        return;
      }
      const problem = (await res.json().catch(() => ({}))) as { error?: string };
      setError(
        problem.error === "rate_limited"
          ? t.tooMany
          : problem.error === "sign_in_required"
            ? t.signedOut
            : t.failed,
      );
    } catch {
      setError(t.failed);
    } finally {
      setSending(false);
    }
  };

  return (
    <form className="cmp cmp--form" onSubmit={submit}>
      <div className="cmp__row">
        <select
          className="cmp__sel"
          value={boardId}
          onChange={(e) => setBoardId(e.target.value as BoardId)}
          aria-label={t.boardLabel}
        >
          {BOARDS.map((b) => (
            <option key={b.id} value={b.id}>
              {b[locale]}
            </option>
          ))}
        </select>
        <span className="cmp__who">{handle}</span>
      </div>

      <input
        className="cmp__title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t.titlePlaceholder}
        aria-label={t.titleLabel}
        maxLength={LIMITS.title.max * 2}
      />

      <textarea
        className="cmp__body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t.bodyPlaceholder}
        aria-label={t.bodyLabel}
        rows={6}
      />

      {error ? (
        <p className="cmp__err" role="alert">
          {error}
        </p>
      ) : null}

      <div className="cmp__foot">
        <span className={titleLeft < 0 || bodyLeft < 0 ? "cmp__left is-over" : "cmp__left"}>
          {titleLeft < 0 ? `${t.titleLabel} ${titleLeft}` : `${bodyLeft}`}
        </span>
        <button className="btn btn--ghost btn--sm" onClick={onClose} type="button">
          {t.cancel}
        </button>
        <button className="btn btn--mint btn--sm" disabled={!valid || sending} type="submit">
          {sending ? t.sending : t.submit}
        </button>
      </div>
    </form>
  );
}
