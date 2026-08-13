"use client";

import { genesisPathFor, getContent, modelPathFor, type Locale } from "@/lib/i18n";
import { n } from "@/lib/format";
import { useLive } from "@/components/community/live-provider";
import cm from "@/data/community.json";

/** Top bar, then the live ticker. Both are chrome the board sits under. */
export function Bar({ locale }: { locale: Locale }) {
  const { watching } = useLive();
  const t = getContent(locale);
  const boards = cm.boards.slice(1, 6);

  return (
    <>
      <a href="#feed" className="skip">
        {t.nav.skip}
      </a>

      <nav className="cmbar" aria-label={locale === "ko" ? "사이트" : "Site"}>
        <div className="cmbar__in">
          <a className="cmbar__mark" href={locale === "ko" ? "/" : "/en"}>
            teslam<span className="cmbar__dot">.</span>io
          </a>

          <div className="cmbar__nav">
            {boards.map((b) => (
              <a key={b.id} href="#feed">
                {b.name}
              </a>
            ))}
            <a href={modelPathFor(locale)}>{t.nav.model}</a>
          </div>

          <div className="cmbar__right">
            {/*
              The real number of people in the room, from the live socket.
              Rendered as nothing at all until a socket is open — an unknown
              count and a count of zero are different facts, and the old value
              here was simply invented.
            */}
            {watching === null ? null : (
              <span className="cmbar__online">
                <span className="cmbar__pulse" aria-hidden="true" />
                {t.nav.online} {n(locale, watching)}
                {t.nav.people}
              </span>
            )}
            <a
              className="cmbar__locale"
              href={t.nav.localeHref}
              hrefLang={locale === "ko" ? "en" : "ko"}
              rel="alternate"
            >
              {t.nav.localeLabel}
            </a>
            <a
              className="cmbar__cta"
              href={genesisPathFor(locale)}
              rel="noopener noreferrer"
              target="_blank"
            >
              {t.nav.cta}
            </a>
          </div>
        </div>
      </nav>

      <Ticker locale={locale} />
    </>
  );
}

/**
 * The ticker is duplicated once so the marquee can loop seamlessly at -50%.
 * The copy is aria-hidden — a screen reader should hear the list once.
 */
function Ticker({ locale }: { locale: Locale }) {
  const t = getContent(locale).live;
  const items = cm.live;

  return (
    <div className="tick">
      <span className="tick__tag">{t.title}</span>
      <div className="tick__vp">
        <div className="tick__row">
          {items.map((x) => (
            <span className="tick__i" key={x.t}>
              {x.t}
              <span className="tick__v">{x.v}</span>
            </span>
          ))}
          {items.map((x) => (
            <span className="tick__i" key={`dup-${x.t}`} aria-hidden="true">
              {x.t}
              <span className="tick__v">{x.v}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
