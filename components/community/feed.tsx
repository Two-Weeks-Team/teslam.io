import { getContent, type Locale } from "@/lib/i18n";
import { Mark } from "@/components/community/mark";
import { LiveFeed } from "@/components/community/live-feed";
import { n } from "@/lib/format";
import { BOARDS } from "@/lib/board";
import type { Mode } from "@/lib/showcase";
import type { Page } from "@/lib/posts";
import cm from "@/data/community.json";

/**
 * The board. On a community site this is the product, so it gets the middle.
 *
 * Three states, and which one appears is not this component's decision — it is
 * the API's, relayed through `mode`. When the board is live these are rows
 * somebody wrote. When it is not, and invented content is permitted, the sample
 * below stands in with a label. When it is not and invented content is
 * forbidden, nothing is drawn at all: an empty page is a truthful page, and a
 * page of plausible fiction is not.
 */
export function Feed({
  locale,
  mode,
  initial,
  now,
  example,
}: {
  locale: Locale;
  mode: Mode;
  initial: Page;
  now: number;
  /** Show what the board looks like populated, under the real one. */
  example?: boolean;
}) {
  if (mode === "hidden") return null;

  if (mode === "real") {
    return (
      <>
        <LiveFeed locale={locale} initial={initial} now={now} />
        {/* A real board with four posts on it — or none — tells a visitor
            nothing about what they are joining. This sits below the real one
            under its own heading, so the two are never mistaken for each
            other, and it leaves with the switch. */}
        {example ? <SampleFeed locale={locale} asExample /> : null}
      </>
    );
  }

  return <SampleFeed locale={locale} />;
}

const TOP_VOTES = Math.max(...cm.posts.map((p) => p.votes));

/**
 * What the board looks like populated.
 *
 * Kept, rather than deleted the moment the real one worked, because a board
 * with four posts on it tells a visitor nothing about what they are joining.
 * It carries the sample mark and it is behind the switch — turn the switch off
 * and this never renders.
 */
function SampleFeed({ locale, asExample = false }: { locale: Locale; asExample?: boolean }) {
  const t = getContent(locale).feed;

  return (
    <section
      className={asExample ? "feed feed--eg" : "feed"}
      // Only one element may own #feed, and when a real board is on the page
      // that is the real one. The skip link and every "back to the board"
      // anchor must land on the thing somebody can actually post to.
      id={asExample ? undefined : "feed"}
      aria-labelledby={asExample ? "feed-eg-h" : "feed-h"}
    >
      {asExample ? (
        <p className="feed__egh" id="feed-eg-h">
          <Mark locale={locale} kind="sample" />
          {t.exampleTitle}
        </p>
      ) : (
        <>
          <p className="fd__mark">
            <Mark locale={locale} kind="sample" />
          </p>
          <h2 className="skip" id="feed-h">
            {t.title}
          </h2>
        </>
      )}

      <div className="feed__top">
        <div className="tabs">
          <span className="tab tab--on">🔥 {t.tabs.hot}</span>
          <a className="tab" href="#feed">
            {t.tabs.latest}
          </a>
          <a className="tab" href="#feed">
            {t.tabs.shots}
          </a>
          <a className="tab" href="#feed">
            {t.tabs.quest}
          </a>
        </div>
        <p className="feed__meta">
          {t.lastHour} · {t.newPosts} 42
        </p>
      </div>

      {cm.posts.map((p) => (
        <article className="post" key={p.id}>
          <div
            className="post__v"
            // Against the loudest post on the board, so the column reads as a
            // ranking of heat rather than as an absolute scale nobody has a
            // reference for.
            style={{ "--v": p.votes / TOP_VOTES } as React.CSSProperties}
          >
            <div className="post__vn">
              {p.votes >= 1000
                ? `${(p.votes / 1000).toFixed(1)}k`
                : n(locale, p.votes)}
            </div>
            <div className="post__vl">▲</div>
            <span className="post__heat" aria-hidden="true" />
          </div>

          <div className="post__b">
            <div className="post__tags">
              <span className="chip">
                {BOARDS.find((b) => b.id === p.board)?.[locale] ?? p.board}
              </span>
              {p.pinned ? <span className="chip chip--pin">📌 {t.pinned}</span> : null}
              {p.staff ? <span className="chip chip--staff">{t.staff}</span> : null}
              {p.genesis ? (
                <span className="chip chip--gen">GENESIS {p.genesis}</span>
              ) : null}
            </div>

            <a className="post__t" href="#feed">
              {p.title}
              <span className="post__c">[{n(locale, p.comments)}]</span>
            </a>

            <p className="post__m">
              {p.author}
              {p.trim ? ` · ${p.trim}` : ""} · {p.ago} · {t.views}{" "}
              {n(locale, p.views)}
            </p>
          </div>
        </article>
      ))}

      <a className="feed__more" href="#feed">
        {t.more} →
      </a>
    </section>
  );
}
