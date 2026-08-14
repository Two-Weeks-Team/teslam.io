"use client";

import { useEffect, useState } from "react";
import { BOARDS, LIMITS, countChars, type Comment, type PostDetail } from "@/lib/board";
import { board, useSession } from "@/components/community/session";
import { getContent, boardPathFor, genesisPathFor, type Locale } from "@/lib/i18n";
import { ago, n } from "@/lib/format";

/**
 * One post and everything said under it.
 *
 * The post and its existing replies arrive as props from the server render, so
 * the whole thread is in the HTML — a discussion nobody can read without
 * JavaScript is not a discussion that was published. Voting and replying need a
 * present reader and start here.
 */
export function Thread({
  locale,
  post,
  now,
}: {
  locale: Locale;
  post: PostDetail;
  now: number;
}) {
  const t = getContent(locale).post;
  const { signedIn, handle } = useSession();

  const [votes, setVotes] = useState(post.votes);
  const [voted, setVoted] = useState(post.voted);
  const [thread, setThread] = useState<Comment[]>(post.thread);

  // The server render is anonymous, so a signed-in reader's own vote is absent
  // from it. One request once we know who they are, rather than blocking the
  // page on an answer nobody needs before it paints.
  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await board(`/v1/board/posts/${post.id}`);
        if (!res.ok || cancelled) return;
        const fresh = (await res.json()) as PostDetail;
        setVotes(fresh.votes);
        setVoted(fresh.voted);
        setThread(fresh.thread);
      } catch {
        // The server-rendered thread stands.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signedIn, post.id]);

  const vote = async () => {
    if (!signedIn) return;
    try {
      const res = await board(`/v1/board/posts/${post.id}/vote`, { method: "POST" });
      if (!res.ok) return;
      const body = (await res.json()) as { voted: boolean; votes: number };
      setVoted(body.voted);
      setVotes(body.votes);
    } catch {
      // Leave the displayed count alone rather than guessing at it.
    }
  };

  return (
    <article className="pst">
      <p className="pst__crumb">
        <a href={boardPathFor(locale)}>{t.backToBoard}</a>
        <span aria-hidden="true"> / </span>
        <span>{BOARDS.find((b) => b.id === post.board)?.[locale] ?? post.board}</span>
      </p>

      <h1 className="pst__h">{post.title}</h1>

      <p className="pst__m">
        {post.handle} · {ago(locale, post.createdAt, now)}
      </p>

      {/* Whitespace preserved by CSS rather than by splitting into paragraphs:
          the body is stored as the author typed it, and React escapes it, so
          nothing a writer types can become markup. */}
      <div className="pst__body">{post.body}</div>

      <div className="pst__acts">
        <button
          className={voted ? "pst__vote is-on" : "pst__vote"}
          onClick={vote}
          disabled={!signedIn}
          title={signedIn ? t.vote : t.voteSignedOut}
          aria-pressed={voted === true}
          type="button"
        >
          ▲ {n(locale, votes)}
        </button>
        <span className="pst__count">
          {t.replies} {n(locale, thread.length)}
        </span>
      </div>

      <section className="th" aria-label={t.replies}>
        {thread.length === 0 ? (
          <p className="th__empty">{t.noReplies}</p>
        ) : (
          thread.map((c) => (
            <div className="th__c" key={c.id}>
              <p className="th__m">
                <b>{c.handle}</b> · {ago(locale, c.createdAt, now)}
              </p>
              <p className="th__b">{c.body}</p>
            </div>
          ))
        )}

        <Reply
          locale={locale}
          postId={post.id}
          signedIn={signedIn}
          handle={handle}
          onAdded={(c) => setThread((prev) => [...prev, c])}
        />
      </section>
    </article>
  );
}

function Reply({
  locale,
  postId,
  signedIn,
  handle,
  onAdded,
}: {
  locale: Locale;
  postId: string;
  signedIn: boolean;
  handle: string | null | undefined;
  onAdded: (c: Comment) => void;
}) {
  const t = getContent(locale).post;
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (handle === undefined) return <div className="th__wait" aria-hidden="true" />;

  if (!signedIn) {
    return (
      <p className="th__out">
        <span>{t.replySignedOut}</span>
        <a className="btn btn--ghost btn--sm" href={genesisPathFor(locale)}>
          {t.replySignedOutCta}
        </a>
      </p>
    );
  }

  const left = LIMITS.comment.max - countChars(body);
  const valid = countChars(body.trim()) >= LIMITS.comment.min && left >= 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await board(`/v1/board/posts/${postId}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: body.trim() }),
      });
      if (res.status === 201) {
        const { id } = (await res.json()) as { id: string };
        // Appended from what was actually sent, with the id the server
        // assigned. Refetching the whole thread to learn one row would throw
        // away the reader's scroll position for no new information.
        onAdded({
          id,
          handle: handle as string,
          body: body.trim(),
          createdAt: Math.floor(Date.now() / 1000),
        });
        setBody("");
        return;
      }
      const problem = (await res.json().catch(() => ({}))) as { error?: string };
      setError(problem.error === "rate_limited" ? t.tooMany : t.failed);
    } catch {
      setError(t.failed);
    } finally {
      setSending(false);
    }
  };

  return (
    <form className="th__form" onSubmit={submit}>
      <textarea
        className="th__ta"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t.replyPlaceholder}
        aria-label={t.replyLabel}
        rows={3}
      />
      {error ? (
        <p className="cmp__err" role="alert">
          {error}
        </p>
      ) : null}
      <div className="th__foot">
        <span className={left < 0 ? "cmp__left is-over" : "cmp__left"}>{left}</span>
        <button className="btn btn--mint btn--sm" disabled={!valid || sending} type="submit">
          {sending ? t.sending : t.reply}
        </button>
      </div>
    </form>
  );
}
