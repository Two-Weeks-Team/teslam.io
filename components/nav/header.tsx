import { genesisPathFor, getModel, type Locale } from "@/lib/i18n";

/**
 * Wordmark, locale switch, and the one call to action.
 *
 * The switch is a plain anchor rather than a control: a crawler has to be able
 * to follow it, and changing locale is a full document load by design — each
 * locale is its own root layout, so `<html lang>` is right without a
 * middleware negotiating on every request.
 */
export function Header({ locale }: { locale: Locale }) {
  const t = getModel(locale).nav;

  return (
    <>
      <a href="#how" className="skip">
        {t.skip}
      </a>
      <nav className="topbar" aria-label={locale === "ko" ? "사이트" : "Site"}>
        <div className="topbar__in">
          <a href={locale === "ko" ? "/" : "/en"} className="topbar__mark">
            teslam<span className="topbar__dot">.</span>io
          </a>
          <div className="topbar__right">
            <a
              className="topbar__locale"
              href={t.localeHref}
              hrefLang={locale === "ko" ? "en" : "ko"}
              rel="alternate"
            >
              {t.localeLabel}
            </a>
            <a
              className="topbar__cta"
              href={genesisPathFor(locale)}
              rel="noopener noreferrer"
              target="_blank"
            >
              {t.cta}
            </a>
          </div>
        </div>
      </nav>
    </>
  );
}
