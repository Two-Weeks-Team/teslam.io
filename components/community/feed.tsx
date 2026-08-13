import { getContent, type Locale } from "@/lib/i18n";
import { Mark } from "@/components/community/mark";
import { n } from "@/lib/format";
import cm from "@/data/community.json";

const TOP_VOTES = Math.max(...cm.posts.map((p) => p.votes));

/** The board. On a community site this is the product, so it gets the middle. */
export function Feed({ locale }: { locale: Locale }) {
  const t = getContent(locale).feed;

  return (
    <section className="feed" id="feed" aria-labelledby="feed-h">
      <p className="fd__mark">
        <Mark locale={locale} kind="sample" />
      </p>
      <h2 className="skip" id="feed-h">
        {t.title}
      </h2>

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
              <span className="chip">{p.board}</span>
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
